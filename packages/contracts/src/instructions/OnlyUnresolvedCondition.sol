// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Calldata } from "@1inch/solidity-utils/contracts/libraries/Calldata.sol";
import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { IConditionalTokens } from "../interfaces/ISeer.sol";

library OnlyUnresolvedConditionArgsBuilder {
    using Calldata for bytes;

    error OnlyUnresolvedConditionMissingArgs();

    function build(address conditionalTokens, bytes32 conditionId) internal pure returns (bytes memory) {
        return abi.encodePacked(conditionalTokens, conditionId);
    }

    function parse(bytes calldata args) internal pure returns (address conditionalTokens, bytes32 conditionId) {
        conditionalTokens = address(bytes20(args.slice(0, 20, OnlyUnresolvedConditionMissingArgs.selector)));
        conditionId = bytes32(args.slice(20, 52, OnlyUnresolvedConditionMissingArgs.selector));
    }
}

/// @title OnlyUnresolvedCondition
/// @notice Reverts once a Conditional Tokens condition has its payouts reported,
///   so nobody can fill an order with an outcome that is already known.
contract OnlyUnresolvedCondition {
    error ConditionAlreadyResolved(bytes32 conditionId);

    /// @param args.conditionalTokens | 20 bytes
    /// @param args.conditionId       | 32 bytes
    function _onlyUnresolvedCondition(Context memory, bytes calldata args) internal view {
        (address conditionalTokens, bytes32 conditionId) = OnlyUnresolvedConditionArgsBuilder.parse(args);
        if (IConditionalTokens(conditionalTokens).payoutDenominator(conditionId) != 0) {
            revert ConditionAlreadyResolved(conditionId);
        }
    }
}
