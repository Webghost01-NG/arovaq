// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface VmLiveDemo {
    function envUint(string calldata name) external returns (uint256 value);
    function envString(string calldata name) external returns (string memory value);
    function envBytes32(string calldata name) external returns (bytes32 value);
    function envAddress(string calldata name) external returns (address value);
    function addr(uint256 privateKey) external returns (address wallet);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

interface IChainMMOLiveDemo {
    function nextCharacterId() external view returns (uint256);
    function nextCommitId() external view returns (uint256);
    function commitFee() external view returns (uint256);
    function createCharacter(uint8 race, uint8 classType, string calldata name) external returns (uint256);
    function claimFreeLootbox(uint256 characterId) external;
    function hashLootboxOpen(
        bytes32 secret,
        address actor,
        uint256 characterId,
        uint64 nonce,
        uint32 tier,
        uint16 amount,
        uint8 varianceMode,
        bool maxMode
    ) external view returns (bytes32);
    function commitActionWithVariance(
        uint256 characterId,
        uint8 actionType,
        bytes32 commitHash,
        uint64 nonce,
        uint8 varianceMode
    ) external payable returns (uint256);
    function revealOpenLootboxesMax(uint256 commitId, bytes32 secret, uint32 tier, uint16 maxAmount, uint8 varianceMode)
        external;
    function equipItem(uint256 characterId, uint256 itemId) external;
    function hashDungeonRun(
        bytes32 secret,
        address actor,
        uint256 characterId,
        uint64 nonce,
        uint8 difficulty,
        uint32 dungeonLevel,
        uint8 varianceMode
    ) external view returns (bytes32);
    function revealStartDungeon(
        uint256 commitId,
        bytes32 secret,
        uint8 difficulty,
        uint32 dungeonLevel,
        uint8 varianceMode
    ) external;
    function resolveRooms(uint256 characterId, uint8[] calldata potionChoices, uint8[] calldata abilityChoices)
        external
        returns (uint8 resolvedCount, bool runStillActive);
}

interface IArovaqLiveDemo {
    function createChallenge(uint32 levelDelta, uint256 rewardPerSuccess, uint32 maxSuccessfulClaims, uint64 deadline)
        external
        payable
        returns (address challenge);
}

interface IArovaqChallengeLiveDemo {
    function register(uint256 characterId) external;
    function claim(address payable recipient) external;
}

/// @notice One-action-per-run helper for the explicitly authorized Monad live demo.
/// @dev Action codes: 1 create character; 2 free lootbox; 3 commit lootbox; 4 reveal lootbox;
/// 5 equip; 6 commit dungeon; 7 reveal dungeon; 8 resolve rooms; 9 create challenge;
/// 10 register; 11 claim. Signing key is read only through Foundry's environment VM.
contract LiveDemo {
    VmLiveDemo private constant vm = VmLiveDemo(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant EXPECTED_CHAIN_ID = 143;
    address private constant GAME_WORLD = 0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77;
    address private constant AROVAQ_FACTORY = 0x8cd2DA9E45D18c47A803f065a3625AE68bF37B17;
    uint8 private constant STABLE_VARIANCE = 0;
    uint32 private constant FREE_LOOTBOX_TIER = 2;

    error WrongChain(uint256 actual);
    error InvalidAction(uint256 action);
    error UnexpectedCharacterId(uint256 expected, uint256 actual);
    error UnexpectedCommitId(uint256 expected, uint256 actual);

    event DemoAction(uint256 indexed action, uint256 indexed characterId, uint256 indexed referenceId, address result);

    function run() external {
        if (block.chainid != EXPECTED_CHAIN_ID) revert WrongChain(block.chainid);
        uint256 action = vm.envUint("AROVAQ_DEMO_ACTION");
        uint256 characterId = vm.envUint("AROVAQ_DEMO_CHARACTER_ID");
        uint256 privateKey = vm.envUint("AROVAQ_DEPLOY_KEY");
        address participant = vm.addr(privateKey);
        IChainMMOLiveDemo world = IChainMMOLiveDemo(GAME_WORLD);

        if (action == 1) {
            uint256 expectedId = world.nextCharacterId();
            string memory name = vm.envString("AROVAQ_DEMO_CHARACTER_NAME");
            vm.startBroadcast(privateKey);
            uint256 createdId = world.createCharacter(0, 0, name);
            vm.stopBroadcast();
            if (createdId != expectedId) revert UnexpectedCharacterId(expectedId, createdId);
            emit DemoAction(action, createdId, 0, participant);
        } else if (action == 2) {
            vm.startBroadcast(privateKey);
            world.claimFreeLootbox(characterId);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, 0, participant);
        } else if (action == 3) {
            bytes32 secret = vm.envBytes32("AROVAQ_DEMO_SECRET");
            uint64 nonce = uint64(vm.envUint("AROVAQ_DEMO_NONCE"));
            uint256 expectedId = world.nextCommitId();
            bytes32 hash = world.hashLootboxOpen(
                secret, participant, characterId, nonce, FREE_LOOTBOX_TIER, 1, STABLE_VARIANCE, true
            );
            vm.startBroadcast(privateKey);
            uint256 commitId =
                world.commitActionWithVariance{value: world.commitFee()}(characterId, 1, hash, nonce, STABLE_VARIANCE);
            vm.stopBroadcast();
            if (commitId != expectedId) revert UnexpectedCommitId(expectedId, commitId);
            emit DemoAction(action, characterId, commitId, participant);
        } else if (action == 4) {
            uint256 commitId = vm.envUint("AROVAQ_DEMO_COMMIT_ID");
            bytes32 secret = vm.envBytes32("AROVAQ_DEMO_SECRET");
            vm.startBroadcast(privateKey);
            world.revealOpenLootboxesMax(commitId, secret, FREE_LOOTBOX_TIER, 1, STABLE_VARIANCE);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, commitId, participant);
        } else if (action == 5) {
            uint256 itemId = vm.envUint("AROVAQ_DEMO_ITEM_ID");
            vm.startBroadcast(privateKey);
            world.equipItem(characterId, itemId);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, itemId, participant);
        } else if (action == 6) {
            uint32 targetLevel = uint32(vm.envUint("AROVAQ_DEMO_TARGET_LEVEL"));
            uint64 nonce = uint64(vm.envUint("AROVAQ_DEMO_NONCE"));
            bytes32 secret = vm.envBytes32("AROVAQ_DEMO_SECRET");
            uint256 expectedId = world.nextCommitId();
            bytes32 hash =
                world.hashDungeonRun(secret, participant, characterId, nonce, 0, targetLevel, STABLE_VARIANCE);
            vm.startBroadcast(privateKey);
            uint256 commitId =
                world.commitActionWithVariance{value: world.commitFee()}(characterId, 2, hash, nonce, STABLE_VARIANCE);
            vm.stopBroadcast();
            if (commitId != expectedId) revert UnexpectedCommitId(expectedId, commitId);
            emit DemoAction(action, characterId, commitId, participant);
        } else if (action == 7) {
            uint256 commitId = vm.envUint("AROVAQ_DEMO_COMMIT_ID");
            uint32 targetLevel = uint32(vm.envUint("AROVAQ_DEMO_TARGET_LEVEL"));
            bytes32 secret = vm.envBytes32("AROVAQ_DEMO_SECRET");
            vm.startBroadcast(privateKey);
            world.revealStartDungeon(commitId, secret, 0, targetLevel, STABLE_VARIANCE);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, commitId, participant);
        } else if (action == 8) {
            uint8[] memory potions = new uint8[](11);
            uint8[] memory abilities = new uint8[](11);
            potions[0] = 1;
            for (uint256 i; i < abilities.length; i++) {
                abilities[i] = 2;
            }
            vm.startBroadcast(privateKey);
            (uint8 resolved, bool active) = world.resolveRooms(characterId, potions, abilities);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, resolved, active ? address(1) : address(0));
        } else if (action == 9) {
            uint64 deadline = uint64(vm.envUint("AROVAQ_DEMO_DEADLINE"));
            uint256 reward = vm.envUint("AROVAQ_DEMO_REWARD_WEI");
            vm.startBroadcast(privateKey);
            address challenge = IArovaqLiveDemo(AROVAQ_FACTORY).createChallenge{value: reward}(1, reward, 1, deadline);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, 1, challenge);
        } else if (action == 10) {
            address challenge = vm.envAddress("AROVAQ_DEMO_CHALLENGE");
            vm.startBroadcast(privateKey);
            IArovaqChallengeLiveDemo(challenge).register(characterId);
            vm.stopBroadcast();
            emit DemoAction(action, characterId, 0, challenge);
        } else if (action == 11) {
            address challenge = vm.envAddress("AROVAQ_DEMO_CHALLENGE");
            vm.startBroadcast(privateKey);
            IArovaqChallengeLiveDemo(challenge).claim(payable(participant));
            vm.stopBroadcast();
            emit DemoAction(action, characterId, 0, challenge);
        } else {
            revert InvalidAction(action);
        }
    }
}
