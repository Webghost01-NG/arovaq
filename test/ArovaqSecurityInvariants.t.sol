// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ArovaqProgressionChallenge} from "../src/ArovaqProgressionChallenge.sol";
import {MockMonotonicGame} from "../src/mocks/MockMonotonicGame.sol";

interface VmSecurityInvariant {
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract SecurityInvariantHandler {
    VmSecurityInvariant private constant vm =
        VmSecurityInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    ArovaqProgressionChallenge[2] private challenges;
    MockMonotonicGame public immutable game;
    address public immutable creator;
    address private constant TEMP_OWNER = address(0xD00D);
    uint256 public steps;
    bool public isolationHeld = true;
    bool public validCompletionHeld = true;
    uint256[2] public reclaimed;
    uint256[2][3] private paidCount;
    uint32[2][3] private capturedBaseline;
    bool[2][3] private captured;

    constructor(
        ArovaqProgressionChallenge first,
        ArovaqProgressionChallenge second,
        MockMonotonicGame game_,
        address creator_
    ) {
        challenges[0] = first;
        challenges[1] = second;
        game = game_;
        creator = creator_;
    }

    function actor(uint256 index) public pure returns (address) {
        if (index % 3 == 0) return address(0x1000);
        if (index % 3 == 1) return address(0x1001);
        return address(0x1002);
    }

    function entity(uint256 index) public pure returns (uint256) {
        return 10 + index % 3;
    }

    function challenge(uint256 index) public view returns (ArovaqProgressionChallenge) {
        return challenges[index % 2];
    }

    function payments(uint256 challengeIndex, uint256 actorIndex) public view returns (uint256) {
        return paidCount[actorIndex % 3][challengeIndex % 2];
    }

    function baseline(uint256 challengeIndex, uint256 actorIndex) public view returns (uint32 value, bool exists) {
        uint256 ai = actorIndex % 3;
        uint256 ci = challengeIndex % 2;
        return (capturedBaseline[ai][ci], captured[ai][ci]);
    }

    function register(uint256 challengeIndex, uint256 actorIndex) external {
        steps++;
        uint256 ci = challengeIndex % 2;
        uint256 ai = actorIndex % 3;
        ArovaqProgressionChallenge c = challenges[ci];
        bytes32 otherBefore = _otherState(ci, actor(ai));
        vm.prank(actor(ai));
        try c.register(entity(ai)) {
            (, uint32 storedBaseline,,,) = c.registrations(actor(ai));
            capturedBaseline[ai][ci] = storedBaseline;
            captured[ai][ci] = true;
        } catch {}
        if (_otherState(ci, actor(ai)) != otherBefore) isolationHeld = false;
    }

    function progress(uint256 actorIndex, uint32 increment) external {
        steps++;
        uint256 ai = actorIndex % 3;
        if (increment == 0) return;
        uint256 id = entity(ai);
        address currentOwner = game.ownerOfCharacter(id);
        uint32 current = game.characterBestLevel(id);
        if (increment > type(uint32).max - current) return;
        vm.prank(currentOwner);
        game.progress(id, current + increment, 2);
    }

    function transfer(uint256 actorIndex, bool back) external {
        steps++;
        uint256 ai = actorIndex % 3;
        uint256 id = entity(ai);
        address currentOwner = game.ownerOfCharacter(id);
        address desired = back ? actor(ai) : TEMP_OWNER;
        if (currentOwner == desired) return;
        vm.prank(currentOwner);
        game.transferCharacter(id, desired);
    }

    function claim(uint256 challengeIndex, uint256 actorIndex) external {
        steps++;
        uint256 ci = challengeIndex % 2;
        uint256 ai = actorIndex % 3;
        ArovaqProgressionChallenge c = challenges[ci];
        address player = actor(ai);
        bytes32 otherBefore = _otherState(ci, player);
        vm.prank(player);
        try c.claim(payable(player)) {
            (uint256 id, uint32 storedBaseline, uint64 target, bool registered, bool claimed) = c.registrations(player);
            if (
                !registered || !claimed || id != entity(ai) || !captured[ai][ci]
                    || storedBaseline != capturedBaseline[ai][ci] || game.ownerOfCharacter(id) != player
                    || game.characterBestLevel(id) < target || block.timestamp >= c.deadline()
            ) {
                validCompletionHeld = false;
            }
            paidCount[ai][ci]++;
        } catch {}
        if (_otherState(ci, player) != otherBefore) isolationHeld = false;
    }

    function expireAndReclaim(uint256 challengeIndex) external {
        steps++;
        if (steps < 20) return;
        uint256 ci = challengeIndex % 2;
        ArovaqProgressionChallenge c = challenges[ci];
        if (block.timestamp < c.deadline()) vm.warp(c.deadline());
        if (c.fundsReclaimed()) return;
        uint256 amount = c.remainingFunding();
        bytes32 otherBefore = _otherState(ci, actor(0));
        vm.prank(creator);
        try c.reclaimExpired(payable(creator)) {
            reclaimed[ci] += amount;
        } catch {}
        if (_otherState(ci, actor(0)) != otherBefore) isolationHeld = false;
    }

    function _otherState(uint256 ci, address player) private view returns (bytes32) {
        ArovaqProgressionChallenge other = challenges[1 - ci];
        (uint256 id, uint32 baselineValue, uint64 target, bool registered, bool claimed) = other.registrations(player);
        return keccak256(
            abi.encode(
                other.remainingFunding(),
                other.successfulClaims(),
                other.fundsReclaimed(),
                id,
                baselineValue,
                target,
                registered,
                claimed
            )
        );
    }
}

contract ArovaqSecurityInvariantTest {
    VmSecurityInvariant private constant vm =
        VmSecurityInvariant(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CREATOR = address(0xC0FFEE);
    ArovaqProgressionChallenge[2] private challenges;
    SecurityInvariantHandler private handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        MockMonotonicGame game = new MockMonotonicGame();
        ArovaqFactory factory = new ArovaqFactory(address(game));
        for (uint256 i; i < 3; i++) {
            address player = i == 0 ? address(0x1000) : i == 1 ? address(0x1001) : address(0x1002);
            game.seed(10 + i, player, 10, 1);
        }
        vm.deal(CREATOR, 12 ether);
        for (uint256 i; i < 2; i++) {
            vm.prank(CREATOR);
            challenges[i] = ArovaqProgressionChallenge(
                factory.createChallenge{value: 6 ether}(3, 1 ether, 6, uint64(block.timestamp + 1000))
            );
        }
        handler = new SecurityInvariantHandler(challenges[0], challenges[1], game, CREATOR);
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariant_FundingConservationAndExpiry() public view {
        for (uint256 ci; ci < 2; ci++) {
            ArovaqProgressionChallenge c = challenges[ci];
            uint256 paid = uint256(c.successfulClaims()) * c.rewardPerSuccess();
            require(c.remainingFunding() + paid + handler.reclaimed(ci) == c.totalFunding(), "funding conservation");
            require(address(c).balance == c.remainingFunding(), "escrow mismatch");
            if (c.fundsReclaimed()) {
                require(block.timestamp >= c.deadline() && c.remainingFunding() == 0, "early reclaim");
            }
        }
    }

    function invariant_ClaimCapSingleRewardAndValidCompletion() public view {
        require(handler.validCompletionHeld(), "invalid completion paid");
        for (uint256 ci; ci < 2; ci++) {
            ArovaqProgressionChallenge c = challenges[ci];
            uint256 counted;
            for (uint256 ai; ai < 3; ai++) {
                uint256 payments = handler.payments(ci, ai);
                require(payments <= 1, "double reward");
                counted += payments;
                (uint256 id, uint32 storedBaseline, uint64 target, bool registered, bool claimed) =
                    c.registrations(handler.actor(ai));
                (uint32 originalBaseline, bool captured) = handler.baseline(ci, ai);
                if (captured) {
                    require(registered && id == handler.entity(ai), "participant binding changed");
                    require(
                        storedBaseline == originalBaseline && target == uint64(originalBaseline) + c.levelDelta(),
                        "baseline mutated"
                    );
                }
                require((payments == 1) == claimed, "reward/claim mismatch");
            }
            require(counted == c.successfulClaims() && counted <= c.maxSuccessfulClaims(), "claim cap");
        }
    }

    function invariant_ImmutableRulesAndIsolation() public view {
        require(handler.isolationHeld(), "cross-challenge mutation");
        for (uint256 ci; ci < 2; ci++) {
            ArovaqProgressionChallenge c = challenges[ci];
            require(c.creator() == CREATOR && c.levelDelta() == 3 && c.rewardPerSuccess() == 1 ether, "rules mutated");
            require(c.maxSuccessfulClaims() == 6 && c.totalFunding() == 6 ether, "economic terms mutated");
            require(c.deadline() == 1_800_001_000, "deadline mutated");
        }
    }
}
