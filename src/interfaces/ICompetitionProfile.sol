// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface ICompetitionProfile {
    function gameWorld() external view returns (address);
    function readProgression(uint256 characterId) external view returns (address owner, uint32 bestLevel);
    function readCharacter(uint256 characterId)
        external
        view
        returns (address owner, uint32 bestLevel, uint32 lastLevelUpEpoch);
    function observableIsMonotonic() external pure returns (bool);
    function observableIsTransferable() external pure returns (bool);
    function hasCanonicalOrdering() external pure returns (bool);
}
