// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {ChainMMOProgressionProfile} from "./profiles/ChainMMOProgressionProfile.sol";
import {ArovaqProgressionChallenge} from "./ArovaqProgressionChallenge.sol";

/// @notice Creates isolated ChainMMO progression challenges with sponsor-funded MON rewards.
contract ArovaqFactory {
    ChainMMOProgressionProfile public immutable profile;

    error InvalidChallengeTerms();
    error IncorrectFunding(uint256 expected, uint256 received);

    event ChallengeCreated(
        address indexed challenge,
        address indexed creator,
        uint32 levelDelta,
        uint256 rewardPerSuccess,
        uint32 maxSuccessfulClaims,
        uint64 deadline
    );

    constructor(address gameWorld) {
        profile = new ChainMMOProgressionProfile(gameWorld);
    }

    function createChallenge(uint32 levelDelta, uint256 rewardPerSuccess, uint32 maxSuccessfulClaims, uint64 deadline)
        external
        payable
        returns (address challenge)
    {
        if (levelDelta == 0 || rewardPerSuccess == 0 || maxSuccessfulClaims == 0 || deadline <= block.timestamp) {
            revert InvalidChallengeTerms();
        }
        uint256 requiredFunding = rewardPerSuccess * maxSuccessfulClaims;
        if (msg.value != requiredFunding) revert IncorrectFunding(requiredFunding, msg.value);

        challenge = address(
            new ArovaqProgressionChallenge{value: msg.value}(
                msg.sender, address(profile), levelDelta, rewardPerSuccess, maxSuccessfulClaims, deadline
            )
        );
        emit ChallengeCreated(challenge, msg.sender, levelDelta, rewardPerSuccess, maxSuccessfulClaims, deadline);
    }
}
