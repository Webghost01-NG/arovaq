// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract MockReentrantGame {
    address public owner;
    uint32 public bestLevel;
    uint32 public lastLevelUpEpoch;
    address private attemptTarget;
    bytes private attemptData;

    function setCharacter(address owner_, uint32 level_, uint32 epoch_) external {
        owner = owner_;
        bestLevel = level_;
        lastLevelUpEpoch = epoch_;
    }

    function setAttempt(address target, bytes calldata data) external {
        attemptTarget = target;
        attemptData = data;
    }

    function ownerOfCharacter(uint256) external view returns (address) {
        _tryReentry();
        return owner;
    }

    function characterBestLevel(uint256) external view returns (uint32) {
        _tryReentry();
        return bestLevel;
    }

    function characterLastLevelUpEpoch(uint256) external view returns (uint32) {
        _tryReentry();
        return lastLevelUpEpoch;
    }

    function _tryReentry() private view {
        if (attemptTarget == address(0)) return;
        (bool ok,) = attemptTarget.staticcall{gas: 5_000}(attemptData);
        require(!ok, "state-changing reentry succeeded");
    }
}
