// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IChainMMOGameWorld} from "../src/interfaces/IChainMMOGameWorld.sol";
import {ChainMMOProgressionProfile} from "../src/profiles/ChainMMOProgressionProfile.sol";

interface VmFork {
    function envString(string calldata key) external returns (string memory value);
    function createSelectFork(string calldata url) external returns (uint256 forkId);
}

contract ChainMMOForkTest {
    VmFork private constant vm = VmFork(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant GAME_WORLD = 0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77;

    function testRealMonadChainMMOCanonicalReadsThroughArovaqProfile() public {
        vm.createSelectFork(vm.envString("MONAD_RPC_URL"));
        require(block.chainid == 143, "wrong chain");
        require(GAME_WORLD.code.length > 0, "GameWorld has no code");

        IChainMMOGameWorld world = IChainMMOGameWorld(GAME_WORLD);
        uint256 total = world.totalCharacters();
        require(total >= 42, "fixture character unavailable");
        address directOwner = world.ownerOfCharacter(42);
        uint32 directBestLevel = world.characterBestLevel(42);
        uint32 directLastLevelUpEpoch = world.characterLastLevelUpEpoch(42);
        require(directOwner != address(0), "character has no owner");

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
