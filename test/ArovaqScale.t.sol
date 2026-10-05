// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ArovaqProgressionChallenge} from "../src/ArovaqProgressionChallenge.sol";
import {MockMonotonicGame} from "../src/mocks/MockMonotonicGame.sol";

interface VmScale {
    function addr(uint256 privateKey) external returns (address);
    function deal(address account, uint256 balance) external;
    function prank(address sender) external;
    function warp(uint256 timestamp) external;
}

contract ArovaqScaleTest {
    VmScale private constant vm = VmScale(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CREATOR = address(0xC0FFEE);
    uint256 private constant REWARD = 1 gwei;

    event ScaleMeasured(
        uint256 participants, uint256 createGas, uint256 lastRegisterGas, uint256 lastClaimGas, uint256 reclaimGas
    );

    function testScale2() public {
        _measure(2);
    }

    function testScale10() public {
        _measure(10);
    }

    function testScale100() public {
        _measure(100);
    }

    function _measure(uint32 count) private {
        vm.warp(1_800_000_000);
        MockMonotonicGame game = new MockMonotonicGame();
        ArovaqFactory factory = new ArovaqFactory(address(game));
        uint32 cap = count + 1;
        vm.deal(CREATOR, uint256(cap) * REWARD);
        vm.prank(CREATOR);
        uint256 startGas = gasleft();
        ArovaqProgressionChallenge challenge = ArovaqProgressionChallenge(
            factory.createChallenge{value: uint256(cap) * REWARD}(1, REWARD, cap, uint64(block.timestamp + 1000))
        );
        uint256 createGas = startGas - gasleft();

        uint256 lastRegisterGas;
        uint256 lastClaimGas;
        for (uint256 i; i < count; i++) {
            address player = vm.addr(i + 1);
            game.seed(i + 1, player, 1, 1);
            vm.prank(player);
            startGas = gasleft();
            challenge.register(i + 1);
            if (i == count - 1) lastRegisterGas = startGas - gasleft();
            vm.prank(player);
            game.progress(i + 1, 2, 2);
            vm.prank(player);
            startGas = gasleft();
            challenge.claim(payable(player));
            if (i == count - 1) lastClaimGas = startGas - gasleft();
        }

        require(challenge.successfulClaims() == count, "participant claims");
        require(challenge.remainingFunding() == REWARD, "one unused reward");
        vm.warp(challenge.deadline());
        vm.prank(CREATOR);
        startGas = gasleft();
        challenge.reclaimExpired(payable(CREATOR));
        uint256 reclaimGas = startGas - gasleft();
        require(challenge.remainingFunding() == 0, "reclaim remaining");
        require(
            createGas < 1_000_000 && lastRegisterGas < 150_000 && lastClaimGas < 150_000 && reclaimGas < 100_000,
            "gas bound"
        );
        emit ScaleMeasured(count, createGas, lastRegisterGas, lastClaimGas, reclaimGas);
    }
}
