// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { Program, ProgramBuilder } from "@1inch/swap-vm/test/utils/ProgramBuilder.sol";

import { OddsFlowRouter } from "../src/OddsFlowRouter.sol";
import { OddsFlowOpcodes } from "../src/OddsFlowOpcodes.sol";
import { OddsFlowTaker } from "../src/OddsFlowTaker.sol";
import { FixedPriceSwapArgsBuilder } from "../src/instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedConditionArgsBuilder } from "../src/instructions/OnlyUnresolvedCondition.sol";
import { ISeerMarket, ISeerRouter } from "../src/interfaces/ISeer.sol";

/// Gnosis fork with the official Aqua, a fresh OddsFlowRouter and
/// OddsFlowTaker, and a real binary Seer market.
abstract contract ForkBase is Test, OddsFlowOpcodes {
    using ProgramBuilder for Program;

    Aqua constant AQUA = Aqua(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a);
    IERC20 constant COLLATERAL = IERC20(0xaf204776c7245bF4147c2612BF6e5972Ee483701);
    ISeerRouter constant SEER_ROUTER = ISeerRouter(0xeC9048b59b3467415b1a38F63416407eA0c70fB8);
    address constant CONDITIONAL_TOKENS = 0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce;
    address constant WXDAI = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    // Binary Seer market on Gnosis, open until 31 Dec 2026: "Will the price of Bitcoin be above
    // 100,000 USD on 31-12-2026?" (checked 2026-09-26)
    address constant MARKET = 0xA202b53641147D9A57AF98CB87723D97FF3162D6;

    uint256 constant YES = 0;
    uint256 constant NO = 1;

    OddsFlowRouter router;
    OddsFlowTaker taker;
    IERC20 yes;
    IERC20 no;
    IERC20 invalid;
    uint64 salt;

    constructor() OddsFlowOpcodes(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a) { }

    function setUp() public virtual {
        vm.createSelectFork(vm.rpcUrl("gnosis"));
        router = new OddsFlowRouter(address(AQUA), WXDAI, address(this), "OddsFlow SwapVM", "1.0.2");
        taker = new OddsFlowTaker(AQUA, ISwapVM(address(router)), COLLATERAL, SEER_ROUTER);
        (yes,) = ISeerMarket(MARKET).wrappedOutcome(0);
        (no,) = ISeerMarket(MARKET).wrappedOutcome(1);
        (invalid,) = ISeerMarket(MARKET).wrappedOutcome(2);
    }

    /// The program of an order buying `token` at `price` sUSDS each, until `deadline`.
    function _program(IERC20 token, uint256 price, uint256 deadline) internal returns (bytes memory) {
        Program memory p = ProgramBuilder.init(_opcodes());
        return bytes.concat(
            p.build(
                _onlyUnresolvedCondition,
                OnlyUnresolvedConditionArgsBuilder.build(CONDITIONAL_TOKENS, ISeerMarket(MARKET).conditionId())
            ),
            p.build(_deadline, ControlsArgsBuilder.buildDeadline(uint40(deadline))),
            p.build(_fixedPriceSwap, FixedPriceSwapArgsBuilder.build(address(token), address(COLLATERAL), price)),
            p.build(_salt, ControlsArgsBuilder.buildSalt(++salt))
        );
    }

    /// An order buying `token` at `price` sUSDS each, until `deadline`.
    function _order(
        address maker,
        IERC20 token,
        uint256 price,
        uint256 deadline
    )
        internal
        returns (ISwapVM.Order memory)
    {
        bytes memory program = _program(token, price, deadline);
        return MakerTraitsLib.build(
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
    }

    function _order(address maker, IERC20 token, uint256 price) internal returns (ISwapVM.Order memory) {
        return _order(maker, token, price, block.timestamp + 1 days);
    }

    /// The maker approves Aqua and publishes the order with `cap` sUSDS.
    function _ship(ISwapVM.Order memory order, IERC20 token, uint256 cap) internal returns (bytes32 strategyHash) {
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(COLLATERAL);
        uint256[] memory amounts = new uint256[](2);
        amounts[1] = cap;
        vm.startPrank(order.maker);
        COLLATERAL.approve(address(AQUA), type(uint256).max);
        strategyHash = AQUA.ship(address(router), abi.encode(order), tokens, amounts);
        vm.stopPrank();
    }

    function _fund(address account, uint256 amount) internal {
        deal(address(COLLATERAL), account, amount);
    }

    /// Gives `account` `amount` of every outcome by splitting sUSDS on Seer.
    function _split(address account, uint256 amount) internal {
        _fund(account, amount);
        vm.startPrank(account);
        COLLATERAL.approve(address(SEER_ROUTER), amount);
        SEER_ROUTER.splitPosition(COLLATERAL, MARKET, amount);
        vm.stopPrank();
    }

    function _takerData(address takerAddress, bool isExactIn) internal pure returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: takerAddress,
                isExactIn: isExactIn,
                shouldUnwrapWeth: false,
                hasPreTransferInCallback: true,
                hasPreTransferOutCallback: false,
                isStrictThresholdAmount: false,
                isFirstTransferFromTaker: false,
                useTransferFromAndAquaPush: false,
                threshold: "",
                to: address(0),
                deadline: 0,
                preTransferInHookData: "",
                postTransferInHookData: "",
                preTransferOutHookData: "",
                postTransferOutHookData: "",
                preTransferInCallbackData: "",
                preTransferOutCallbackData: "",
                instructionsArgs: "",
                signature: ""
            })
        );
    }

    function _one(ISwapVM.Order memory order) internal pure returns (ISwapVM.Order[] memory orders) {
        orders = new ISwapVM.Order[](1);
        orders[0] = order;
    }

    function _two(
        ISwapVM.Order memory a,
        ISwapVM.Order memory b
    )
        internal
        pure
        returns (ISwapVM.Order[] memory orders)
    {
        orders = new ISwapVM.Order[](2);
        orders[0] = a;
        orders[1] = b;
    }

    function _assertTakerEmpty() internal view {
        assertEq(COLLATERAL.balanceOf(address(taker)), 0, "taker holds no collateral");
        assertEq(yes.balanceOf(address(taker)), 0, "taker holds no YES");
        assertEq(no.balanceOf(address(taker)), 0, "taker holds no NO");
        assertEq(invalid.balanceOf(address(taker)), 0, "taker holds no invalid");
    }
}
