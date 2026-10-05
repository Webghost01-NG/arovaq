// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IChainMMOGameWorld} from "../interfaces/IChainMMOGameWorld.sol";
import {ICompetitionProfile} from "../interfaces/ICompetitionProfile.sol";

/// @notice Canonical ChainMMO identity/progression reader. No ChainMMO integration is required.
contract ChainMMOProgressionProfile is ICompetitionProfile {
    uint256 public constant GAME_READ_GAS_LIMIT = 100_000;
    address public immutable gameWorld;

    error InvalidGameWorld();
    error GameReadFailed(bytes4 selector);
    error MalformedGameReturn(bytes4 selector);

    constructor(address gameWorld_) {
        if (gameWorld_.code.length == 0) revert InvalidGameWorld();
        gameWorld = gameWorld_;
    }

    function readCharacter(uint256 characterId)
        external
        view
        returns (address owner, uint32 bestLevel, uint32 lastLevelUpEpoch)
    {
        (owner, bestLevel) = _readProgression(characterId);
        lastLevelUpEpoch = _readUint32(
            abi.encodeCall(IChainMMOGameWorld.characterLastLevelUpEpoch, (characterId)),
            IChainMMOGameWorld.characterLastLevelUpEpoch.selector
        );
    }

    function readProgression(uint256 characterId) external view returns (address owner, uint32 bestLevel) {
        return _readProgression(characterId);
    }

    function observableIsMonotonic() external pure returns (bool) {
        return true;
    }

    function observableIsTransferable() external pure returns (bool) {
        return false;
    }

    function hasCanonicalOrdering() external pure returns (bool) {
        return false;
    }

    function _readProgression(uint256 characterId) private view returns (address owner, uint32 bestLevel) {
        owner = _readAddress(
            abi.encodeCall(IChainMMOGameWorld.ownerOfCharacter, (characterId)),
            IChainMMOGameWorld.ownerOfCharacter.selector
        );
        bestLevel = _readUint32(
            abi.encodeCall(IChainMMOGameWorld.characterBestLevel, (characterId)),
            IChainMMOGameWorld.characterBestLevel.selector
        );
    }

    function _readAddress(bytes memory input, bytes4 selector) private view returns (address value) {
        bytes memory result = _staticRead(input, selector);
        uint256 word;
        assembly { word := mload(add(result, 32)) }
        if (word >> 160 != 0) revert MalformedGameReturn(selector);
        value = abi.decode(result, (address));
    }

    function _readUint32(bytes memory input, bytes4 selector) private view returns (uint32 value) {
        bytes memory result = _staticRead(input, selector);
        uint256 word;
        assembly { word := mload(add(result, 32)) }
        if (word > type(uint32).max) revert MalformedGameReturn(selector);
        value = abi.decode(result, (uint32));
    }

    function _staticRead(bytes memory input, bytes4 selector) private view returns (bytes memory result) {
        bool ok;
        (ok, result) = gameWorld.staticcall{gas: GAME_READ_GAS_LIMIT}(input);
        if (!ok) revert GameReadFailed(selector);
        if (result.length != 32) revert MalformedGameReturn(selector);
    }
}
