// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Simulator } from "@1inch/solidity-utils/contracts/mixins/Simulator.sol";
import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { SwapVM } from "@1inch/swap-vm/src/SwapVM.sol";
import { OddsFlowOpcodes } from "./OddsFlowOpcodes.sol";

/// @title OddsFlowRouter
/// @notice AquaSwapVMRouter from 1inch/swap-vm v1.0.2 with OddsFlowOpcodes as its
///   instruction set. Same constructor, same settlement, same Aqua.
contract OddsFlowRouter is Simulator, SwapVM, OddsFlowOpcodes {
    constructor(
        address aqua,
        address weth,
        address owner,
        string memory name,
        string memory version
    )
        SwapVM(aqua, weth, owner, name, version)
        OddsFlowOpcodes(aqua)
    { }

    function _instructions()
        internal
        pure
        override
        returns (function(Context memory, bytes calldata) internal[] memory)
    {
        return _opcodes();
    }
}
