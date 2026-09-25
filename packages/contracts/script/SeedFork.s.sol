// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { Program, ProgramBuilder } from "@1inch/swap-vm/test/utils/ProgramBuilder.sol";
import { OddsFlowOpcodes } from "../src/OddsFlowOpcodes.sol";
import { FixedPriceSwapArgsBuilder } from "../src/instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedConditionArgsBuilder } from "../src/instructions/OnlyUnresolvedCondition.sol";
import { ISeerMarket } from "../src/interfaces/ISeer.sol";

/// Local fork only (scripts/dev-fork.sh): publishes sample orders on MARKET from
/// Anvil accounts 1 and 2, which dev-fork.sh funded with sDAI beforehand.
contract SeedFork is Script, OddsFlowOpcodes {
    using ProgramBuilder for Program;

    IAqua constant AQUA = IAqua(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a);
    address constant SDAI = 0xaf204776c7245bF4147c2612BF6e5972Ee483701;
    address constant CONDITIONAL_TOKENS = 0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce;
    // Anvil's default accounts 1 and 2 ("test test ... junk")
    uint256 constant ALICE_KEY = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant BOB_KEY = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    constructor() OddsFlowOpcodes(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a) { }

    function run(address router, address market, uint256 deadline) external {
        (IERC20 yes,) = ISeerMarket(market).wrappedOutcome(0);
        (IERC20 no,) = ISeerMarket(market).wrappedOutcome(1);
        bytes32 conditionId = ISeerMarket(market).conditionId();

        _publish(ALICE_KEY, router, conditionId, yes, 0.2e18, 1000e18, deadline, 1);
        _publish(ALICE_KEY, router, conditionId, yes, 0.25e18, 100e18, deadline, 2);
        _publish(BOB_KEY, router, conditionId, no, 0.6e18, 500e18, deadline, 3);
    }

    function _publish(
        uint256 key,
        address router,
        bytes32 conditionId,
        IERC20 token,
        uint256 price,
        uint256 cap,
        uint256 deadline,
        uint64 salt
    )
        internal
    {
        Program memory p = ProgramBuilder.init(_opcodes());
        bytes memory program = bytes.concat(
            p.build(_onlyUnresolvedCondition, OnlyUnresolvedConditionArgsBuilder.build(CONDITIONAL_TOKENS, conditionId)),
            p.build(_deadline, ControlsArgsBuilder.buildDeadline(uint40(deadline))),
            p.build(_fixedPriceSwap, FixedPriceSwapArgsBuilder.build(address(token), SDAI, price)),
            p.build(_salt, ControlsArgsBuilder.buildSalt(salt))
        );
        address maker = vm.addr(key);
        ISwapVM.Order memory order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: maker,
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
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = SDAI;
        uint256[] memory amounts = new uint256[](2);
        amounts[1] = cap;

        vm.startBroadcast(key);
        IERC20(SDAI).approve(address(AQUA), type(uint256).max);
        bytes32 hash = AQUA.ship(router, abi.encode(order), tokens, amounts);
        vm.stopBroadcast();
        console.logBytes32(hash);
    }
}
