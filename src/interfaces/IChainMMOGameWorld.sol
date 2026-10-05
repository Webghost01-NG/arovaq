// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @notice Read-only subset of the independently deployed ChainMMO GameWorld.
interface IChainMMOGameWorld {
    function totalCharacters() external view returns (uint256);
    function ownerOfCharacter(uint256 characterId) external view returns (address);
    function characterBestLevel(uint256 characterId) external view returns (uint32);
    function characterLastLevelUpEpoch(uint256 characterId) external view returns (uint32);
}
