// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ArovaqProgressionChallenge} from "../src/ArovaqProgressionChallenge.sol";
import {ChainMMOProgressionProfile} from "../src/profiles/ChainMMOProgressionProfile.sol";
import {MockMonotonicGame} from "../src/mocks/MockMonotonicGame.sol";
import {MockRevertingGame} from "../src/mocks/MockRevertingGame.sol";
import {MockMalformedReturnGame} from "../src/mocks/MockMalformedReturnGame.sol";
import {MockReentrantGame} from "../src/mocks/MockReentrantGame.sol";

interface Vm {
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function assume(bool condition) external;
}

contract ArovaqPhase1Test {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CREATOR = address(0xC0FFEE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    MockMonotonicGame private game;
    ArovaqFactory private factory;

    function setUp() public {
        vm.warp(1_700_000_000);
        vm.deal(CREATOR, 100 ether);
        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
        game = new MockMonotonicGame();
        game.seed(42, ALICE, 17, 100);
        game.seed(43, BOB, 10, 80);
        factory = new ArovaqFactory(address(game));
    }

    function testRegistrationCapturesCanonicalOwnerBaselineAndDerivedTarget() public {
        address challenge = _create(3, 1 ether, 10, uint64(block.timestamp + 1_000));
        vm.prank(ALICE);
        ArovaqProgressionChallenge(challenge).register(42);
        (uint256 characterId, uint32 baseline, uint64 target, bool registered, bool claimed) =
            ArovaqProgressionChallenge(challenge).registrations(ALICE);
        require(characterId == 42 && baseline == 17 && target == 20 && registered && !claimed, "baseline/target");
        require(ArovaqProgressionChallenge(challenge).characterParticipant(42) == ALICE, "binding");
    }

    function testBaselineRelativeChallengeRequiresCanonicalProgressAndPaysOnce() public {
        address challenge = _create(3, 1 ether, 2, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        c.claim(payable(ALICE));
        vm.prank(ALICE);
        game.progress(42, 19, 101);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        c.claim(payable(ALICE));
        vm.prank(ALICE);
        game.progress(42, 20, 102);
        uint256 beforeBalance = ALICE.balance;
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        require(ALICE.balance - beforeBalance == 1 ether, "reward");
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.AlreadyClaimed.selector);
        c.claim(payable(ALICE));
        require(c.successfulClaims() == 1 && c.remainingFunding() == 1 ether, "accounting");
    }

    function testHigherHistoricalLevelDoesNotSatisfyBaselineRelativeGoal() public {
        game.seed(44, BOB, 900, 400);
        address challenge = _create(3, 1 ether, 1, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(BOB);
        c.register(44);
        (,, uint64 target,,) = c.registrations(BOB);
        require(target == 903, "absolute threshold substituted");
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        c.claim(payable(BOB));
    }

    function testNonOwnerAndDuplicateCharacterBindingRejected() public {
        address challenge = _create(1, 1 ether, 2, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.NotCharacterOwner.selector);
        c.register(42);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.AlreadyRegistered.selector);
        c.register(43);
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.CharacterAlreadyBound.selector);
        c.register(42);
    }

    function testOwnershipIsCheckedAgainAtClaimAndCannotBeSubstituted() public {
        address challenge = _create(1, 1 ether, 2, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 101);
        vm.prank(ALICE);
        game.transferCharacter(42, BOB);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotCharacterOwner.selector);
        c.claim(payable(ALICE));
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.NotRegistered.selector);
        c.claim(payable(BOB));
        require(c.successfulClaims() == 0 && c.remainingFunding() == 2 ether, "ownership theft");
    }

    function testRulesAndFundingAreFixedAndPoolCannotBeWithdrawnEarly() public {
        vm.prank(CREATOR);
        vm.expectRevert();
        factory.createChallenge{value: 1 ether}(3, 1 ether, 2, uint64(block.timestamp + 1_000));
        address challenge = _create(3, 1 ether, 2, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        (bool changed,) = challenge.call(abi.encodeWithSignature("setLevelDelta(uint32)", 1));
        require(!changed && c.levelDelta() == 3, "rules mutable");
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqProgressionChallenge.NotExpired.selector);
        c.reclaimExpired(payable(CREATOR));
        require(address(c).balance == 2 ether, "active reward custody");
    }

    function testExpiryClosesClaimsAndReturnsOnlyUnusedFunding() public {
        uint64 deadline = uint64(block.timestamp + 100);
        address challenge = _create(1, 1 ether, 3, deadline);
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 101);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        uint256 creatorBefore = CREATOR.balance;
        vm.warp(deadline);
        vm.prank(CREATOR);
        c.reclaimExpired(payable(CREATOR));
        require(CREATOR.balance - creatorBefore == 2 ether, "unused funding return");
        require(address(c).balance == 0 && c.remainingFunding() == 0, "stuck funds");
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.Expired.selector);
        c.claim(payable(ALICE));
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqProgressionChallenge.AlreadyClaimed.selector);
        c.reclaimExpired(payable(CREATOR));
    }

    function testExpiredReclaimCannotBeCalledByNonCreator() public {
        uint64 deadline = uint64(block.timestamp + 5);
        address challenge = _create(1, 1 ether, 1, deadline);
        vm.warp(deadline);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.Unauthorized.selector);
        ArovaqProgressionChallenge(challenge).reclaimExpired(payable(CREATOR));
    }

    function testMaxClaimsCapsRewardsAndChallengesAreIsolated() public {
        address first = _create(1, 1 ether, 1, uint64(block.timestamp + 1_000));
        address second = _create(1, 2 ether, 1, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge a = ArovaqProgressionChallenge(first);
        ArovaqProgressionChallenge b = ArovaqProgressionChallenge(second);
        vm.prank(ALICE);
        a.register(42);
        vm.prank(BOB);
        a.register(43);
        vm.prank(ALICE);
        b.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 101);
        vm.prank(BOB);
        game.progress(43, 11, 81);
        vm.prank(ALICE);
        a.claim(payable(ALICE));
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.RewardsExhausted.selector);
        a.claim(payable(BOB));
        require(address(b).balance == 2 ether && b.remainingFunding() == 2 ether, "pool isolation");
    }

    function testReadFailuresAndMalformedReturnFailClosed() public {
        MockRevertingGame reverting = new MockRevertingGame();
        ChainMMOProgressionProfile p1 = new ChainMMOProgressionProfile(address(reverting));
        vm.expectRevert();
        p1.readCharacter(1);

        MockMalformedReturnGame malformed = new MockMalformedReturnGame();
        ChainMMOProgressionProfile p2 = new ChainMMOProgressionProfile(address(malformed));
        vm.expectRevert();
        p2.readCharacter(1);
    }

    function testStaticGameReadCannotReenterClaimState() public {
        MockReentrantGame hostile = new MockReentrantGame();
        hostile.setCharacter(address(hostile), 5, 1);
        ArovaqFactory hostileFactory = new ArovaqFactory(address(hostile));
        vm.prank(CREATOR);
        address challenge =
            hostileFactory.createChallenge{value: 1 ether}(1, 1 ether, 1, uint64(block.timestamp + 1_000));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        hostile.setAttempt(challenge, abi.encodeWithSelector(c.claim.selector, payable(address(hostile))));
        vm.prank(address(hostile));
        c.register(55);
        vm.prank(address(hostile));
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        c.claim(payable(address(hostile)));
        require(c.successfulClaims() == 0 && c.remainingFunding() == 1 ether, "read reentry changed accounting");
    }

    function testPayoutCanBeRedirectedAfterTransferFailureWithoutConsumingClaim() public {
        address challenge = _create(1, 1 ether, 1, uint64(block.timestamp + 100));
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 101);
        RejectEther rejector = new RejectEther();
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.TransferFailed.selector);
        c.claim(payable(address(rejector)));
        (,,,, bool claimed) = c.registrations(ALICE);
        require(!claimed && c.remainingFunding() == 1 ether, "failed transfer consumed claim");
        vm.prank(ALICE);
        c.claim(payable(ALICE));
    }

    function testNonexistentCharacterCannotRegisterAndRaceIsDisabled() public {
        address challenge = _create(1, 1 ether, 1, uint64(block.timestamp + 1_000));
        vm.prank(ALICE);
        vm.expectRevert();
        ArovaqProgressionChallenge(challenge).register(999);
        require(!factory.profile().hasCanonicalOrdering(), "unsupported race enabled");
    }

    function testEOAGameTargetRejected() public {
        vm.expectRevert(ChainMMOProgressionProfile.InvalidGameWorld.selector);
        new ChainMMOProgressionProfile(address(0x1234));
    }

    function testFuzzCanonicalBaselineAndDelta(
        address participant,
        uint256 characterId,
        uint32 baselineSeed,
        uint32 deltaSeed,
        uint64 rewardSeed,
        uint32 maxSeed
    ) public {
        vm.assume(participant != address(0) && participant != CREATOR && participant != address(this));
        uint32 baseline = baselineSeed % 1_000_000;
        uint32 delta = deltaSeed % 10_000 + 1;
        uint256 reward = uint256(rewardSeed) % 1e12 + 1;
        uint32 maxClaims = maxSeed % 5 + 1;
        vm.deal(CREATOR, reward * maxClaims);
        vm.deal(participant, 1 ether);
        game.seed(characterId, participant, baseline, 5);
        uint64 deadline = uint64(block.timestamp + 100);
        address challenge = _create(delta, reward, maxClaims, deadline);
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(challenge);
        vm.prank(participant);
        c.register(characterId);
        (uint256 storedId, uint32 storedBaseline, uint64 target, bool registered,) = c.registrations(participant);
        require(
            storedId == characterId && storedBaseline == baseline && target == uint64(baseline) + delta && registered,
            "fuzz baseline"
        );
        uint32 reachableTarget = baseline + delta; // Both fuzz inputs are bounded above before this addition.
        vm.prank(participant);
        game.progress(characterId, reachableTarget, 6);
        uint256 beforeBalance = ALICE.balance;
        vm.prank(participant);
        c.claim(payable(ALICE));
        require(ALICE.balance - beforeBalance == reward && c.successfulClaims() == 1, "fuzz claim");
        vm.warp(deadline);
        uint256 creatorBefore = CREATOR.balance;
        vm.prank(CREATOR);
        c.reclaimExpired(payable(CREATOR));
        uint256 refunded = uint256(maxClaims - 1) * reward;
        require(CREATOR.balance - creatorBefore == refunded, "fuzz unused rewards");
        require(reward + refunded == reward * maxClaims, "fuzz conservation");
    }

    function _create(uint32 delta, uint256 reward, uint32 maxClaims, uint64 deadline)
        private
        returns (address challenge)
    {
        uint256 funding = reward * maxClaims;
        vm.prank(CREATOR);
        challenge = factory.createChallenge{value: funding}(delta, reward, maxClaims, deadline);
    }
}

contract RejectEther {
    receive() external payable {
        revert("reject");
    }
}
