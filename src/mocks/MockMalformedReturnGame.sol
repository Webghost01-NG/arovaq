// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/// @dev Every unknown selector returns one byte, which is not a valid ABI word.
contract MockMalformedReturnGame {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(31, 1)
        }
    }
}
