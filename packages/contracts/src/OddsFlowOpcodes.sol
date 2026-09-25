// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { AquaOpcodes } from "@1inch/swap-vm/src/opcodes/AquaOpcodes.sol";
import { FixedPriceSwap } from "./instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedCondition } from "./instructions/OnlyUnresolvedCondition.sol";

/// @title OddsFlowOpcodes
/// @notice The official Aqua opcode table, unchanged, with two instructions
///   appended at the end so every official opcode keeps its index.
contract OddsFlowOpcodes is AquaOpcodes, FixedPriceSwap, OnlyUnresolvedCondition {
    constructor(address aqua) AquaOpcodes(aqua) { }

    function _opcodes()
        internal
        pure
        virtual
        override
        returns (function(Context memory, bytes calldata) internal[] memory result)
    {
        function(Context memory, bytes calldata) internal[] memory official = super._opcodes();
        result = new function(Context memory, bytes calldata) internal[](official.length + 2);
        for (uint256 i = 0; i < official.length; i++) {
            result[i] = official[i];
        }
        result[official.length] = FixedPriceSwap._fixedPriceSwap;
        result[official.length + 1] = OnlyUnresolvedCondition._onlyUnresolvedCondition;
    }
}
