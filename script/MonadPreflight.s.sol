// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IChainMMOGameWorld} from "../src/interfaces/IChainMMOGameWorld.sol";

interface VmPreflight {
    function envUint(string calldata name) external returns (uint256 value);
    function addr(uint256 privateKey) external returns (address wallet);
}

/// @notice Read-only checks. Run against Monad RPC without --broadcast.
contract MonadPreflight {
    VmPreflight private constant vm = VmPreflight(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant MONAD_CHAIN_ID = 143;
    address private constant GAME_WORLD = 0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77;
    uint256 private constant CHARACTER_ID = 42;

    error WrongChain(uint256 actual);
    error MissingGameWorld();
    error MissingCharacter();
    error MissingDeployer();

    event PreflightEvidence(
        uint256 chainId,
        uint256 blockNumber,
        address gameWorld,
        uint256 totalCharacters,
        uint256 characterId,
        address owner,
        uint32 bestLevel,
        uint32 lastLevelUpEpoch,
        address deployer,
        uint256 deployerBalanceWei
    );

    function run() external {
        if (block.chainid != MONAD_CHAIN_ID) revert WrongChain(block.chainid);
        if (GAME_WORLD.code.length == 0) revert MissingGameWorld();

        IChainMMOGameWorld world = IChainMMOGameWorld(GAME_WORLD);
        uint256 total = world.totalCharacters();
        if (total < CHARACTER_ID) revert MissingCharacter();
        address owner = world.ownerOfCharacter(CHARACTER_ID);
        if (owner == address(0)) revert MissingCharacter();
        uint32 bestLevel = world.characterBestLevel(CHARACTER_ID);
        uint32 epoch = world.characterLastLevelUpEpoch(CHARACTER_ID);

        // Read the configured key only inside Foundry's script VM. Never log or pass it as a CLI argument.
        address deployer = vm.addr(vm.envUint("AROVAQ_DEPLOY_KEY"));
        if (deployer == address(0)) revert MissingDeployer();
        emit PreflightEvidence(
            block.chainid,
            block.number,
            GAME_WORLD,
            total,
            CHARACTER_ID,
            owner,
            bestLevel,
            epoch,
            deployer,
            deployer.balance
        );
    }
}
