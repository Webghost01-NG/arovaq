// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import {IChainMMOGameWorld} from "../interfaces/IChainMMOGameWorld.sol";

/// @dev Adversarial ABI fixture, not a supported progression profile.
contract MockHostileGame {
    enum Mode {
        Honest,
        Revert,
        Empty,
        Short,
        Oversized,
        BadAddress,
        BadUint32,
        BurnGas,
        SpoofProgress,
        ZeroOwner
    }

    Mode public mode;
    address public owner;
    uint32 public level;

    function configure(Mode mode_, address owner_, uint32 level_) external {
        mode = mode_;
        owner = owner_;
        level = level_;
    }

    fallback() external {
        bytes4 selector = msg.sig;
        bool isOwner = selector == IChainMMOGameWorld.ownerOfCharacter.selector;
        bool isLevel = selector == IChainMMOGameWorld.characterBestLevel.selector;
        if (!isOwner && !isLevel) revert("selector absent");

        Mode current = mode;
        if (current == Mode.Revert) revert("foreign revert");
        if (current == Mode.Empty) assembly { return(0, 0) }
        if (current == Mode.Short) {
            assembly {
                mstore(0, 1)
                return(0, 31)
            }
        }
        if (current == Mode.Oversized) {
            assembly {
                mstore(0, 1)
                mstore(32, 2)
                return(0, 64)
            }
        }
        if (current == Mode.BurnGas) assembly { for {} 1 {} {} }

        uint256 word = isOwner ? uint256(uint160(owner)) : uint256(level);
        if (current == Mode.BadAddress && isOwner) word = type(uint256).max;
        if (current == Mode.BadUint32 && isLevel) word = uint256(type(uint32).max) + 1;
        if (current == Mode.SpoofProgress && isLevel) word = type(uint32).max;
        if (current == Mode.ZeroOwner && isOwner) word = 0;
        assembly {
            mstore(0, word)
            return(0, 32)
        }
    }
}
