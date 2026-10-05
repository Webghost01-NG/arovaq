// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ArovaqFactory} from "../src/ArovaqFactory.sol";
import {ChainMMOProgressionProfile} from "../src/profiles/ChainMMOProgressionProfile.sol";
import {IChainMMOGameWorld} from "../src/interfaces/IChainMMOGameWorld.sol";

interface VmDeploy {
    function envUint(string calldata name) external returns (uint256 value);
    function addr(uint256 privateKey) external returns (address wallet);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys only the accepted factory and its ChainMMO progression profile.
contract DeployArovaq {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant MONAD_CHAIN_ID = 143;
    address private constant GAME_WORLD = 0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77;

    error WrongChain(uint256 actual);
    error MissingGameWorld();
    error IncompatibleGameWorld();
    error NoDeployerBalance();
    error InvalidDeployment();

    event DeploymentEvidence(
        address indexed deployer, address indexed factory, address indexed profile, uint256 chainId
    );

    function run() external returns (address factoryAddress, address profileAddress) {
        if (block.chainid != MONAD_CHAIN_ID) revert WrongChain(block.chainid);
        if (GAME_WORLD.code.length == 0) revert MissingGameWorld();

        IChainMMOGameWorld world = IChainMMOGameWorld(GAME_WORLD);
        if (world.totalCharacters() < 42 || world.ownerOfCharacter(42) == address(0)) {
            revert IncompatibleGameWorld();
        }
        world.characterBestLevel(42);
        world.characterLastLevelUpEpoch(42);

        // The key stays in the process environment and Foundry VM; it is never logged or passed on the command line.
        uint256 privateKey = vm.envUint("AROVAQ_DEPLOY_KEY");
        address deployer = vm.addr(privateKey);
        if (deployer.balance == 0) revert NoDeployerBalance();

        vm.startBroadcast(privateKey);
        ArovaqFactory factory = new ArovaqFactory(GAME_WORLD);
        vm.stopBroadcast();

        ChainMMOProgressionProfile profile = factory.profile();
        if (address(profile) == address(0) || profile.gameWorld() != GAME_WORLD) revert InvalidDeployment();
        factoryAddress = address(factory);
        profileAddress = address(profile);
        emit DeploymentEvidence(deployer, factoryAddress, profileAddress, block.chainid);
    }
}
