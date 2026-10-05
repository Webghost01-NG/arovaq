// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ICompetitionProfile} from "./interfaces/ICompetitionProfile.sol";

/// @notice Isolated, immutable-rule, sponsor-funded ChainMMO progression challenge.
contract ArovaqProgressionChallenge {
    struct Registration {
        uint256 characterId;
        uint32 baseline;
        uint64 target;
        bool registered;
        bool claimed;
    }

    address public immutable creator;
    ICompetitionProfile public immutable profile;
    uint32 public immutable levelDelta;
    uint256 public immutable rewardPerSuccess;
    uint32 public immutable maxSuccessfulClaims;
    uint64 public immutable deadline;
    uint256 public immutable totalFunding;

    uint32 public successfulClaims;
    uint256 public remainingFunding;
    bool public fundsReclaimed;
    bool private entered;

    mapping(address => Registration) public registrations;
    mapping(uint256 => address) public characterParticipant;

    error InvalidConfiguration();
    error Expired();
    error NotExpired();
    error AlreadyRegistered();
    error CharacterAlreadyBound();
    error NotCharacterOwner();
    error NotRegistered();
    error AlreadyClaimed();
    error NotComplete();
    error RewardsExhausted();
    error Unauthorized();
    error TransferFailed();
    error Reentrancy();

    event Registered(address indexed participant, uint256 indexed characterId, uint32 baseline, uint64 target);
    event RewardClaimed(address indexed participant, address indexed recipient, uint256 amount, uint256 characterId);
    event ExpiredFundsReclaimed(address indexed creator, uint256 amount);

    modifier nonReentrant() {
        if (entered) revert Reentrancy();
        entered = true;
        _;
        entered = false;
    }

    constructor(
        address creator_,
        address profile_,
        uint32 levelDelta_,
        uint256 rewardPerSuccess_,
        uint32 maxSuccessfulClaims_,
        uint64 deadline_
    ) payable {
        uint256 expected = rewardPerSuccess_ * maxSuccessfulClaims_;
        if (
            creator_ == address(0) || profile_.code.length == 0 || levelDelta_ == 0 || rewardPerSuccess_ == 0
                || maxSuccessfulClaims_ == 0 || deadline_ <= block.timestamp || msg.value != expected
        ) revert InvalidConfiguration();
        creator = creator_;
        profile = ICompetitionProfile(profile_);
        levelDelta = levelDelta_;
        rewardPerSuccess = rewardPerSuccess_;
        maxSuccessfulClaims = maxSuccessfulClaims_;
        deadline = deadline_;
        totalFunding = msg.value;
        remainingFunding = msg.value;
    }

    /// @notice Atomically binds caller to an owned character and captures canonical baseline.
    function register(uint256 characterId) external {
        if (block.timestamp >= deadline) revert Expired();
        if (registrations[msg.sender].registered) revert AlreadyRegistered();
        if (characterParticipant[characterId] != address(0)) revert CharacterAlreadyBound();

        (address owner, uint32 baseline) = profile.readProgression(characterId);
        if (owner != msg.sender) revert NotCharacterOwner();
        uint64 target = uint64(baseline) + uint64(levelDelta);
        registrations[msg.sender] = Registration(characterId, baseline, target, true, false);
        characterParticipant[characterId] = msg.sender;
        emit Registered(msg.sender, characterId, baseline, target);
    }

    /// @notice Challenge semantics are first-valid-claim, not first-achieved chronology.
    function claim(address payable recipient) external nonReentrant {
        if (block.timestamp >= deadline) revert Expired();
        Registration storage r = registrations[msg.sender];
        if (!r.registered) revert NotRegistered();
        if (r.claimed) revert AlreadyClaimed();
        if (successfulClaims >= maxSuccessfulClaims) revert RewardsExhausted();
        (address owner, uint32 currentLevel) = profile.readProgression(r.characterId);
        if (owner != msg.sender) revert NotCharacterOwner();
        if (uint64(currentLevel) < r.target) revert NotComplete();

        r.claimed = true;
        successfulClaims++;
        remainingFunding -= rewardPerSuccess;
        _pay(recipient, rewardPerSuccess);
        emit RewardClaimed(msg.sender, recipient, rewardPerSuccess, r.characterId);
    }

    /// @notice Creator can reclaim only unused reward inventory after claims close.
    function reclaimExpired() external nonReentrant {
        if (msg.sender != creator) revert Unauthorized();
        if (block.timestamp < deadline) revert NotExpired();
        if (fundsReclaimed) revert AlreadyClaimed();
        fundsReclaimed = true;
        uint256 amount = remainingFunding;
        remainingFunding = 0;
        if (amount != 0) _pay(payable(creator), amount);
        emit ExpiredFundsReclaimed(creator, amount);
    }

    function readCurrent(uint256 characterId) external view returns (address owner, uint32 bestLevel) {
        (owner, bestLevel) = profile.readProgression(characterId);
    }

    function _pay(address payable recipient, uint256 amount) private {
        if (recipient == address(0)) revert InvalidConfiguration();
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
