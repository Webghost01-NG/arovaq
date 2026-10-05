// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract MockMonotonicGame {
    struct Character {
        address owner;
        uint32 bestLevel;
        uint32 lastLevelUpEpoch;
        bool exists;
    }
    mapping(uint256 => Character) private characters;
    uint256 public totalCharacters;

    error MissingCharacter();
    error Unauthorized();

    function seed(uint256 id, address owner, uint32 level, uint32 epoch) external {
        if (!characters[id].exists) totalCharacters++;
        characters[id] = Character(owner, level, epoch, true);
    }

    function ownerOfCharacter(uint256 id) external view returns (address) {
        if (!characters[id].exists) revert MissingCharacter();
        return characters[id].owner;
    }

    function characterBestLevel(uint256 id) external view returns (uint32) {
        if (!characters[id].exists) revert MissingCharacter();
        return characters[id].bestLevel;
    }

    function characterLastLevelUpEpoch(uint256 id) external view returns (uint32) {
        if (!characters[id].exists) revert MissingCharacter();
        return characters[id].lastLevelUpEpoch;
    }

    function progress(uint256 id, uint32 newBest, uint32 epoch) external {
        Character storage c = characters[id];
        if (!c.exists) revert MissingCharacter();
        if (c.owner != msg.sender) revert Unauthorized();
        if (newBest <= c.bestLevel) revert Unauthorized();
        c.bestLevel = newBest;
        c.lastLevelUpEpoch = epoch;
    }

    function transferCharacter(uint256 id, address recipient) external {
        Character storage c = characters[id];
        if (!c.exists) revert MissingCharacter();
        if (c.owner != msg.sender) revert Unauthorized();
        c.owner = recipient;
    }
}
