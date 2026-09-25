// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { Program, ProgramBuilder } from "@1inch/swap-vm/test/utils/ProgramBuilder.sol";
import { OddsFlowOpcodes } from "../src/OddsFlowOpcodes.sol";
import { FixedPriceSwapArgsBuilder } from "../src/instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedConditionArgsBuilder } from "../src/instructions/OnlyUnresolvedCondition.sol";

/// Writes packages/core/src/fixtures/order.json: the opcode indices and one
/// order built the Solidity way. packages/core must build the same bytes and
/// the same strategyHash from the same inputs, or the web would publish one
/// order and show another (AGENTS.md, "strategyHash parity").
contract ParityTest is Test, OddsFlowOpcodes {
    using ProgramBuilder for Program;

    address constant MAKER = 0x00000000000000000000000000000000000A11cE;
    address constant CONDITIONAL_TOKENS = 0xAb797C4C6022A401c31543E316D3cd04c67a87fC;
    bytes32 constant CONDITION_ID = 0x7fc983a02b29e65ff37cf355fe399042e2e45a081cb8dbe28068d16ccd22b7e4;
    address constant TOKEN_IN = 0x5554375F5989a4A0e8Bc67c1645eba0013c91686;
    address constant SUSDS = 0x5875eEE11Cf8398102FdAd704C9E96607675467a;
    uint256 constant PRICE = 0.2e18;
    uint40 constant DEADLINE = 1_790_521_200;
    uint64 constant SALT = 42;

    constructor() OddsFlowOpcodes(address(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a)) { }

    function _index(function(Context memory, bytes calldata) internal instruction) internal pure returns (uint256) {
        return ProgramBuilder.findOpcode(ProgramBuilder.init(_opcodes()), instruction);
    }

    function test_writeParityFixture() public {
        Program memory p = ProgramBuilder.init(_opcodes());
        bytes memory program = bytes.concat(
            p.build(
                _onlyUnresolvedCondition, OnlyUnresolvedConditionArgsBuilder.build(CONDITIONAL_TOKENS, CONDITION_ID)
            ),
            p.build(_deadline, ControlsArgsBuilder.buildDeadline(DEADLINE)),
            p.build(_fixedPriceSwap, FixedPriceSwapArgsBuilder.build(TOKEN_IN, SUSDS, PRICE)),
            p.build(_salt, ControlsArgsBuilder.buildSalt(SALT))
        );
        ISwapVM.Order memory order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: MAKER,
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                receiver: address(0),
                hasPreTransferInHook: false,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(0),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: program
            })
        );
        bytes memory strategy = abi.encode(order);

        string memory o = "opcodes";
        vm.serializeUint(o, "onlyUnresolvedCondition", _index(_onlyUnresolvedCondition));
        vm.serializeUint(o, "deadline", _index(_deadline));
        vm.serializeUint(o, "fixedPriceSwap", _index(_fixedPriceSwap));
        string memory opcodes = vm.serializeUint(o, "salt", _index(_salt));

        string memory i = "inputs";
        vm.serializeAddress(i, "maker", MAKER);
        vm.serializeAddress(i, "conditionalTokens", CONDITIONAL_TOKENS);
        vm.serializeBytes32(i, "conditionId", CONDITION_ID);
        vm.serializeAddress(i, "tokenIn", TOKEN_IN);
        vm.serializeAddress(i, "tokenOut", SUSDS);
        vm.serializeString(i, "price", vm.toString(PRICE));
        vm.serializeUint(i, "deadline", DEADLINE);
        string memory inputs = vm.serializeUint(i, "salt", SALT);

        string memory root = "fixture";
        vm.serializeString(root, "opcodes", opcodes);
        vm.serializeString(root, "inputs", inputs);
        vm.serializeBytes(root, "program", program);
        vm.serializeString(root, "traits", vm.toString(MakerTraits_unwrap(order)));
        vm.serializeBytes(root, "strategy", strategy);
        string memory out = vm.serializeBytes32(root, "strategyHash", keccak256(strategy));
        vm.writeJson(out, "../core/src/fixtures/order.json");
    }

    function MakerTraits_unwrap(ISwapVM.Order memory order) internal pure returns (uint256) {
        return uint256(abi.decode(abi.encode(order.traits), (uint256)));
    }
}
