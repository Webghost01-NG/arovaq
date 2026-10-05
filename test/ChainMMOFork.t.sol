// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IChainMMOGameWorld} from "../src/interfaces/IChainMMOGameWorld.sol";
import {ChainMMOProgressionProfile} from "../src/profiles/ChainMMOProgressionProfile.sol";

interface VmFork {
    function envString(string calldata key) external returns (string memory value);
    function createSelectFork(string calldata url) external returns (uint256 forkId);
    function createSelectFork(string calldata url, uint256 blockNumber) external returns (uint256 forkId);
}

contract ChainMMOForkTest {
    VmFork private constant vm = VmFork(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GAME_WORLD = 0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77;
    uint256 private constant FORK_BLOCK = 110729013;

    function testRealMonadChainMMOCanonicalReadsThroughArovaqProfile() public {
        vm.createSelectFork(vm.envString("MONAD_RPC_URL"), FORK_BLOCK);
        require(block.chainid == 143, "wrong chain");
        require(block.number == FORK_BLOCK, "wrong fork block");
        require(GAME_WORLD.code.length > 0, "GameWorld has no code");

        IChainMMOGameWorld world = IChainMMOGameWorld(GAME_WORLD);
        uint256 total = world.totalCharacters();
        require(total == 64, "character count changed at pinned block");
        address directOwner = world.ownerOfCharacter(42);
        uint32 directBestLevel = world.characterBestLevel(42);
        uint32 directLastLevelUpEpoch = world.characterLastLevelUpEpoch(42);
        require(directOwner == 0x9f2B43e65856741af08A7b6412747026EC371A0A, "owner mismatch at pinned block");
        require(directBestLevel == 1, "best level mismatch at pinned block");
        require(directLastLevelUpEpoch == 492020, "epoch mismatch at pinned block");

        ChainMMOProgressionProfile profile = new ChainMMOProgressionProfile(GAME_WORLD);
        (address profileOwner, uint32 profileBestLevel, uint32 profileEpoch) = profile.readCharacter(42);
        require(profileOwner == directOwner, "profile owner mismatch");
        require(profileBestLevel == directBestLevel, "profile level mismatch");
        require(profileEpoch == directLastLevelUpEpoch, "profile epoch mismatch");
        require(profile.observableIsMonotonic(), "best level classification");
        require(!profile.observableIsTransferable(), "progression classification");
        require(!profile.hasCanonicalOrdering(), "race must remain unavailable");
    }
}
