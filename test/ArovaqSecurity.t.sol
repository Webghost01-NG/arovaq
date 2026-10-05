// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ArovaqProgressionChallenge} from "../src/ArovaqProgressionChallenge.sol";
import {ChainMMOProgressionProfile} from "../src/profiles/ChainMMOProgressionProfile.sol";
import {MockHostileGame} from "../src/mocks/MockHostileGame.sol";
import {MockMonotonicGame} from "../src/mocks/MockMonotonicGame.sol";

interface VmSecurity {
    function etch(address target, bytes calldata code) external;
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function assume(bool condition) external;
}

contract RejectingSponsor {
    function create(ArovaqFactory factory, uint64 deadline) external payable returns (ArovaqProgressionChallenge) {
        return ArovaqProgressionChallenge(factory.createChallenge{value: msg.value}(1, msg.value, 1, deadline));
    }

    function reclaim(ArovaqProgressionChallenge challenge, address payable recipient) external {
        challenge.reclaimExpired(recipient);
    }

    receive() external payable {
        revert("reject native transfer");
    }
}

contract ReenteringRecipient {
    ArovaqProgressionChallenge public challenge;
    bool public reentryFailed;

    function setChallenge(ArovaqProgressionChallenge challenge_) external {
        challenge = challenge_;
    }

    receive() external payable {
        (bool ok,) = address(challenge).call(abi.encodeCall(ArovaqProgressionChallenge.claim, (payable(address(this)))));
        reentryFailed = !ok;
    }
}

contract ForceNative {
    constructor() payable {}

    function force(address payable target) external {
        selfdestruct(target);
    }
}

contract SelectorlessGame {
    function unrelated(uint256) external pure returns (uint256) {
        return 1;
    }
}

contract ArovaqSecurityTest {
    VmSecurity private constant vm = VmSecurity(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CREATOR = address(0xC0FFEE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    MockMonotonicGame private game;
    ArovaqFactory private factory;

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.deal(CREATOR, 100 ether);
        game = new MockMonotonicGame();
        game.seed(42, ALICE, 17, 1);
        game.seed(43, BOB, 10, 1);
        factory = new ArovaqFactory(address(game));
    }

    function testOwnershipAwayAndBackRestoresOnlyOriginalRegistrantRight() public {
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 100);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        vm.prank(ALICE);
        game.transferCharacter(42, BOB);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotCharacterOwner.selector);
        c.claim(payable(ALICE));
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.CharacterAlreadyBound.selector);
        c.register(42);
        vm.prank(BOB);
        vm.expectRevert(ArovaqProgressionChallenge.NotRegistered.selector);
        c.claim(payable(BOB));
        vm.prank(BOB);
        game.transferCharacter(42, ALICE);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        require(c.successfulClaims() == 1, "returning owner");
    }

    function testProgressMadeWhileCharacterIsAwayCanCountAfterReturn() public {
        ArovaqProgressionChallenge c = _create(3, 1 ether, 1, 100);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.transferCharacter(42, BOB);
        vm.prank(BOB);
        game.progress(42, 20, 2);
        vm.prank(BOB);
        game.transferCharacter(42, ALICE);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        require(c.successfulClaims() == 1, "endpoint ownership semantics");
    }

    function testUnreachableTargetIsRejectedBeforeBinding() public {
        game.seed(44, ALICE, type(uint32).max, 1);
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 100);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.UnreachableTarget.selector);
        c.register(44);
        require(c.characterParticipant(44) == address(0), "impossible character bound");
        game.seed(44, ALICE, type(uint32).max - 1, 1);
        vm.prank(ALICE);
        c.register(44);
        (,, uint64 target,,) = c.registrations(ALICE);
        require(target == type(uint32).max, "maximum reachable target");
        vm.prank(ALICE);
        game.progress(44, type(uint32).max, 2);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
    }

    function testCharacterIdZeroAndMaximumAreBoundByCanonicalOwner() public {
        game.seed(0, ALICE, 3, 1);
        game.seed(type(uint256).max, BOB, 4, 1);
        ArovaqProgressionChallenge c = _create(1, 1 ether, 2, 100);
        vm.prank(ALICE);
        c.register(0);
        vm.prank(BOB);
        c.register(type(uint256).max);
        require(c.characterParticipant(0) == ALICE, "zero ID binding");
        require(c.characterParticipant(type(uint256).max) == BOB, "maximum ID binding");
    }

    function testBadTermsAndExactFunding() public {
        uint64 deadline = uint64(block.timestamp + 100);
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqFactory.InvalidChallengeTerms.selector);
        factory.createChallenge{value: 0}(0, 1, 1, deadline);
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqFactory.InvalidChallengeTerms.selector);
        factory.createChallenge{value: 0}(1, 0, 1, deadline);
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqFactory.InvalidChallengeTerms.selector);
        factory.createChallenge{value: 0}(1, 1, 0, deadline);
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqFactory.InvalidChallengeTerms.selector);
        factory.createChallenge{value: 1}(1, 1, 1, uint64(block.timestamp));
        vm.prank(CREATOR);
        vm.expectRevert();
        factory.createChallenge{value: 1}(1, 1, 2, deadline);
        vm.prank(CREATOR);
        vm.expectRevert();
        factory.createChallenge{value: 3}(1, 1, 2, deadline);
        vm.prank(CREATOR);
        vm.expectRevert();
        factory.createChallenge{value: 0}(1, type(uint256).max, 2, deadline);
    }

    function testClaimAndReclaimExactDeadlineBoundary() public {
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 10);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        vm.warp(c.deadline() - 1);
        vm.prank(CREATOR);
        vm.expectRevert(ArovaqProgressionChallenge.NotExpired.selector);
        c.reclaimExpired(payable(CREATOR));
        vm.warp(c.deadline());
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.Expired.selector);
        c.claim(payable(ALICE));
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.Expired.selector);
        c.register(43);
        vm.prank(CREATOR);
        c.reclaimExpired(payable(CREATOR));
        require(c.remainingFunding() == 0 && c.successfulClaims() == 0, "expiry accounting");
    }

    function testCreatorContractCanRecoverAfterFailedReclaimRecipient() public {
        RejectingSponsor sponsor = new RejectingSponsor();
        vm.deal(address(this), 1 ether);
        ArovaqProgressionChallenge c = sponsor.create{value: 1 ether}(factory, uint64(block.timestamp + 10));
        vm.warp(c.deadline());
        vm.expectRevert(ArovaqProgressionChallenge.TransferFailed.selector);
        sponsor.reclaim(c, payable(address(sponsor)));
        require(!c.fundsReclaimed() && c.remainingFunding() == 1 ether, "failed reclaim consumed rights");
        uint256 beforeBalance = CREATOR.balance;
        sponsor.reclaim(c, payable(CREATOR));
        require(CREATOR.balance - beforeBalance == 1 ether && c.remainingFunding() == 0, "recoverable reclaim");
    }

    function testReentrantRecipientCannotDoubleClaim() public {
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 100);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        ReenteringRecipient recipient = new ReenteringRecipient();
        recipient.setChallenge(c);
        vm.prank(ALICE);
        c.claim(payable(address(recipient)));
        require(recipient.reentryFailed(), "reentry was not rejected");
        require(c.successfulClaims() == 1 && address(recipient).balance == 1 ether, "double payout");
    }

    function testForcedNativeTransferDoesNotIncreaseClaimEntitlement() public {
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 100);
        vm.deal(address(this), 0.1 ether);
        ForceNative force = new ForceNative{value: 0.1 ether}();
        force.force(payable(address(c)));
        require(address(c).balance == 1.1 ether && c.remainingFunding() == 1 ether, "forced balance");
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        require(c.successfulClaims() == 1 && c.remainingFunding() == 0, "allocation changed");
        require(address(c).balance == 0.1 ether, "forced surplus accounting");
    }

    function testFinalClaimThenExpiryReclaimCannotDoubleSpend() public {
        ArovaqProgressionChallenge c = _create(1, 1 ether, 1, 10);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        vm.prank(ALICE);
        c.claim(payable(ALICE));
        require(c.remainingFunding() == 0 && address(c).balance == 0, "fully claimed");
        vm.warp(c.deadline());
        uint256 beforeBalance = CREATOR.balance;
        vm.prank(CREATOR);
        c.reclaimExpired(payable(CREATOR));
        require(CREATOR.balance == beforeBalance && c.fundsReclaimed(), "double spent final reward");
    }

    function testAdversarialClaimOrderingExhaustsOnlyThisChallenge() public {
        ArovaqProgressionChallenge a = _create(1, 1 ether, 1, 100);
        ArovaqProgressionChallenge b = _create(1, 2 ether, 1, 100);
        vm.prank(ALICE);
        a.register(42);
        vm.prank(BOB);
        a.register(43);
        vm.prank(ALICE);
        b.register(42);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        vm.prank(BOB);
        game.progress(43, 11, 2);
        vm.prank(BOB);
        a.claim(payable(BOB));
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.RewardsExhausted.selector);
        a.claim(payable(ALICE));
        require(b.remainingFunding() == 2 ether && b.successfulClaims() == 0, "cross-challenge accounting");
        vm.prank(ALICE);
        b.claim(payable(ALICE));
    }

    function testHostileForeignReturnShapesAndGasFailClosed() public {
        MockHostileGame hostile = new MockHostileGame();
        hostile.configure(MockHostileGame.Mode.Honest, ALICE, 17);
        ChainMMOProgressionProfile profile = new ChainMMOProgressionProfile(address(hostile));
        ArovaqFactory hostileFactory = new ArovaqFactory(address(hostile));
        vm.prank(CREATOR);
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(
            hostileFactory.createChallenge{value: 1 ether}(1, 1 ether, 1, uint64(block.timestamp + 100))
        );
        vm.prank(ALICE);
        c.register(42);

        for (uint8 mode = 1; mode <= 7; mode++) {
            hostile.configure(MockHostileGame.Mode(mode), ALICE, 18);
            vm.prank(ALICE);
            vm.expectRevert();
            c.claim(payable(ALICE));
            require(c.successfulClaims() == 0 && c.remainingFunding() == 1 ether, "foreign failure changed accounting");
        }
        hostile.configure(MockHostileGame.Mode.ZeroOwner, ALICE, 18);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotCharacterOwner.selector);
        c.claim(payable(ALICE));
        hostile.configure(MockHostileGame.Mode.Honest, ALICE, 16);
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        c.claim(payable(ALICE));
        hostile.configure(MockHostileGame.Mode.Honest, ALICE, 18);
        vm.expectRevert();
        profile.readCharacter(42); // Last-level-up selector is intentionally absent.
        vm.prank(ALICE);
        c.claim(payable(ALICE));
    }

    function testMissingSelectorAndDisappearedCodeFailClosed() public {
        SelectorlessGame selectorless = new SelectorlessGame();
        ArovaqFactory selectorlessFactory = new ArovaqFactory(address(selectorless));
        vm.prank(CREATOR);
        ArovaqProgressionChallenge c = ArovaqProgressionChallenge(
            selectorlessFactory.createChallenge{value: 1 ether}(1, 1 ether, 1, uint64(block.timestamp + 100))
        );
        vm.prank(ALICE);
        vm.expectRevert();
        c.register(42);
        require(c.remainingFunding() == 1 ether && c.characterParticipant(42) == address(0), "selector failure");

        ChainMMOProgressionProfile profile = new ChainMMOProgressionProfile(address(game));
        vm.etch(address(game), hex""); // Simulates code disappearance; current EVM restricts SELFDESTRUCT deletion.
        vm.expectRevert();
        profile.readProgression(42);
    }

    function testArbitraryTargetCanLieAboutSemanticsButNotOtherChallenge() public {
        MockHostileGame hostile = new MockHostileGame();
        hostile.configure(MockHostileGame.Mode.Honest, ALICE, 17);
        ArovaqFactory hostileFactory = new ArovaqFactory(address(hostile));
        vm.prank(CREATOR);
        ArovaqProgressionChallenge hostileChallenge = ArovaqProgressionChallenge(
            hostileFactory.createChallenge{value: 1 ether}(1, 1 ether, 1, uint64(block.timestamp + 100))
        );
        ArovaqProgressionChallenge canonical = _create(1, 2 ether, 1, 100);
        vm.prank(ALICE);
        hostileChallenge.register(42);
        vm.prank(ALICE);
        canonical.register(42);
        hostile.configure(MockHostileGame.Mode.SpoofProgress, ALICE, 17);
        vm.prank(ALICE);
        hostileChallenge.claim(payable(ALICE));
        require(hostileChallenge.successfulClaims() == 1, "spoof fixture did not demonstrate trust boundary");
        vm.prank(ALICE);
        vm.expectRevert(ArovaqProgressionChallenge.NotComplete.selector);
        canonical.claim(payable(ALICE));
        require(canonical.remainingFunding() == 2 ether, "hostile target affected other competition");
    }

    function testFuzzBindingProgressDeadlineAndConservation(
        address participant,
        uint256 characterId,
        uint32 baseline,
        uint32 deltaSeed,
        uint32 progressSeed,
        uint64 rewardSeed,
        uint16 deadlineSeed,
        bool transferAway,
        bool transferBack,
        bool expire
    ) public {
        // Exclude reserved EVM precompiles; some reject an empty native payout call.
        vm.assume(
            uint160(participant) > 0x10000 && participant != ALICE && participant != BOB && participant != CREATOR
        );
        uint32 delta = deltaSeed % 1000 + 1;
        uint256 reward = uint256(rewardSeed) % 1e15 + 1;
        vm.deal(CREATOR, reward);
        game.seed(characterId, participant, baseline, 1);
        uint64 deadline = uint64(block.timestamp + deadlineSeed % 1000 + 1);
        vm.prank(CREATOR);
        ArovaqProgressionChallenge c =
            ArovaqProgressionChallenge(factory.createChallenge{value: reward}(delta, reward, 1, deadline));
        if (uint64(baseline) + delta > type(uint32).max) {
            vm.prank(participant);
            vm.expectRevert(ArovaqProgressionChallenge.UnreachableTarget.selector);
            c.register(characterId);
            return;
        }
        vm.prank(participant);
        c.register(characterId);
        uint32 current = progressSeed < baseline ? baseline : progressSeed;
        if (current > baseline) {
            vm.prank(participant);
            game.progress(characterId, current, 2);
        }
        if (transferAway) {
            vm.prank(participant);
            game.transferCharacter(characterId, BOB);
            if (transferBack) {
                vm.prank(BOB);
                game.transferCharacter(characterId, participant);
            }
        }
        if (expire) vm.warp(deadline);
        bool eligible = !expire && (!transferAway || transferBack) && uint64(current) >= uint64(baseline) + delta;
        uint256 beforeBalance = ALICE.balance;
        vm.prank(participant);
        if (!eligible) vm.expectRevert();
        c.claim(payable(ALICE));
        require(c.successfulClaims() == (eligible ? 1 : 0), "fuzz eligibility");
        require(ALICE.balance - beforeBalance == (eligible ? reward : 0), "fuzz payout");
        require(c.remainingFunding() + uint256(c.successfulClaims()) * reward == reward, "fuzz conservation");
    }

    function testFuzzClaimOrderPartialClaimsAndReclaim(
        bool bobFirst,
        bool bobReady,
        uint8 capSeed,
        uint64 rewardSeed,
        uint16 deadlineSeed
    ) public {
        uint32 cap = uint32(capSeed % 2) + 1;
        uint256 reward = uint256(rewardSeed) % 1e15 + 1;
        uint64 offset = uint64(deadlineSeed % 1000) + 1;
        vm.deal(CREATOR, reward * cap);
        ArovaqProgressionChallenge c = _create(1, reward, cap, offset);
        vm.prank(ALICE);
        c.register(42);
        vm.prank(BOB);
        c.register(43);
        vm.prank(ALICE);
        game.progress(42, 18, 2);
        if (bobReady) {
            vm.prank(BOB);
            game.progress(43, 11, 2);
        }
        address first = bobFirst ? BOB : ALICE;
        address second = bobFirst ? ALICE : BOB;
        uint32 paid;
        for (uint256 i; i < 2; i++) {
            address player = i == 0 ? first : second;
            bool eligible = player == ALICE || bobReady;
            bool shouldPay = eligible && paid < cap;
            vm.prank(player);
            if (!shouldPay) vm.expectRevert();
            c.claim(payable(player));
            if (shouldPay) paid++;
        }
        require(c.successfulClaims() == paid, "fuzz claim order");
        require(c.remainingFunding() + uint256(paid) * reward == reward * cap, "fuzz partial accounting");
        vm.warp(c.deadline());
        uint256 beforeBalance = CREATOR.balance;
        vm.prank(CREATOR);
        c.reclaimExpired(payable(CREATOR));
        require(CREATOR.balance - beforeBalance == uint256(cap - paid) * reward, "fuzz expiry refund");
    }

    function _create(uint32 delta, uint256 reward, uint32 maxClaims, uint64 deadlineOffset)
        private
        returns (ArovaqProgressionChallenge)
    {
        vm.prank(CREATOR);
        return ArovaqProgressionChallenge(
            factory.createChallenge{value: reward * maxClaims}(
                delta, reward, maxClaims, uint64(block.timestamp + deadlineOffset)
            )
        );
    }
}
