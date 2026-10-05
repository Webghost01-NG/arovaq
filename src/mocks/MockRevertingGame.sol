// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract MockRevertingGame {
    function ownerOfCharacter(uint256) external pure returns (address) {
        revert("missing");
    }

    function characterBestLevel(uint256) external pure returns (uint32) {
        revert("missing");
    }

    function characterLastLevelUpEpoch(uint256) external pure returns (uint32) {
        revert("missing");
    }
}
