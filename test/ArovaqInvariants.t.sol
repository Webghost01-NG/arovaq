// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ArovaqProgressionChallenge} from "../src/ArovaqProgressionChallenge.sol";
import {MockMonotonicGame} from "../src/mocks/MockMonotonicGame.sol";

interface VmInvariant {
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract ArovaqInvariantHandler {
    VmInvariant private constant vm = VmInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    ArovaqProgressionChallenge public immutable challenge;
    MockMonotonicGame public immutable game;
    address public immutable creator;
    uint256 public immutable characterId;
    uint256 public reclaimed;

    constructor(
        ArovaqProgressionChallenge challenge_,
        MockMonotonicGame game_,
        address creator_,
        uint256 characterId_
    ) {
        challenge = challenge_;
        game = game_;
        creator = creator_;
        characterId = characterId_;
    }

    function register() external {
        try challenge.register(characterId) {} catch {}
    }

    function progress(uint32 increment) external {
        (,,, bool registered,) = challenge.registrations(address(this));
        if (!registered || block.timestamp >= challenge.deadline() || increment == 0) return;
        uint32 current = game.characterBestLevel(characterId);
        if (increment > type(uint32).max - current) return;
        game.progress(characterId, current + increment, uint32(block.timestamp));
    }

    function claim() external {
        try challenge.claim(payable(address(this))) {} catch {}
    }

    function expireAndReclaim() external {
        if (block.timestamp < challenge.deadline()) vm.warp(challenge.deadline());
        if (!challenge.fundsReclaimed()) {
            uint256 amount = challenge.remainingFunding();
            vm.prank(creator);
            try challenge.reclaimExpired() {
                reclaimed += amount;
            } catch {}
        }
    }

    receive() external payable {}
}

contract ArovaqInvariantTest {
    VmInvariant private constant vm = VmInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CREATOR = address(0xC0FFEE);

    MockMonotonicGame private game;
    ArovaqProgressionChallenge private challenge;
    ArovaqInvariantHandler private handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        uint256 reward = 1 ether;
        uint32 maxClaims = 5;
        game = new MockMonotonicGame();
        ArovaqFactory factory = new ArovaqFactory(address(game));
        vm.deal(CREATOR, reward * maxClaims);
        vm.prank(CREATOR);
        address challengeAddress =
            factory.createChallenge{value: reward * maxClaims}(3, reward, maxClaims, uint64(block.timestamp + 200));
        challenge = ArovaqProgressionChallenge(challengeAddress);
        handler = new ArovaqInvariantHandler(challenge, game, CREATOR, 77);
        game.seed(77, address(handler), 10, 1);
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariant_PayoutsAndReclaimsConserveCommittedFunding() public view {
        uint256 accounted = challenge.remainingFunding() + uint256(challenge.successfulClaims())
            * challenge.rewardPerSuccess() + handler.reclaimed();
        require(accounted == challenge.totalFunding(), "funding conservation");
        require(address(challenge).balance == challenge.remainingFunding(), "escrow balance mismatch");
    }

    function invariant_RewardClaimsRespectRegistrationAndCap() public view {
        (uint256 characterId, uint32 baseline, uint64 target, bool registered, bool claimed) =
            challenge.registrations(address(handler));
        require(challenge.successfulClaims() <= challenge.maxSuccessfulClaims(), "claim cap");
        require(challenge.successfulClaims() == (claimed ? 1 : 0), "unregistered reward or duplicate");
        if (registered) {
            require(characterId == handler.characterId(), "character binding changed");
            require(target >= baseline, "target below baseline");
            require(challenge.characterParticipant(characterId) == address(handler), "character mapping changed");
        }
    }

    function invariant_ImmutableTermsAndExpiredReclaim() public view {
        require(challenge.levelDelta() == 3, "delta mutated");
        require(challenge.rewardPerSuccess() == 1 ether, "reward mutated");
        require(challenge.maxSuccessfulClaims() == 5, "cap mutated");
        if (challenge.fundsReclaimed()) require(block.timestamp >= challenge.deadline(), "early reclaim");
    }
}
