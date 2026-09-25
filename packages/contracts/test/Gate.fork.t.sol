// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { MockTaker } from "@1inch/swap-vm/test/mocks/MockTaker.sol";
import { Program, ProgramBuilder } from "@1inch/swap-vm/test/utils/ProgramBuilder.sol";

import { OddsFlowRouter } from "../src/OddsFlowRouter.sol";
import { OddsFlowOpcodes } from "../src/OddsFlowOpcodes.sol";
import { FixedPriceSwapArgsBuilder } from "../src/instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedConditionArgsBuilder } from "../src/instructions/OnlyUnresolvedCondition.sol";
import { ISeerMarket, ISeerRouter } from "../src/interfaces/ISeer.sol";

/// Phase 0 gate (spec/definicion/07): an order shipped on the official Aqua for a
/// redeployed router with FixedPriceSwap fills at exactly its price, in quote and
/// swap, against a real Seer market on a Base fork.
contract GateForkTest is Test, OddsFlowOpcodes {
    using ProgramBuilder for Program;

    Aqua constant AQUA = Aqua(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a);
    IERC20 constant SUSDS = IERC20(0x5875eEE11Cf8398102FdAd704C9E96607675467a);
    ISeerRouter constant SEER_ROUTER = ISeerRouter(0x3124e97ebF4c9592A17d40E54623953Ff3c77a73);
    address constant CONDITIONAL_TOKENS = 0xAb797C4C6022A401c31543E316D3cd04c67a87fC;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    // Binary Seer market on Base, open to answers but not resolved (checked 2026-09-26)
    ISeerMarket constant MARKET = ISeerMarket(0x12C4fE96f354C128c8CaD897C19dAAFFc8b99Beb);

    uint256 constant PRICE = 0.2e18;
    uint256 constant CAP = 1000e18;

    OddsFlowRouter router;
    MockTaker taker;
    address maker = makeAddr("maker");
    IERC20 yes;

    constructor() OddsFlowOpcodes(address(0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a)) { }

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"));
        router = new OddsFlowRouter(address(AQUA), WETH, address(this), "OddsFlow SwapVM", "1.0.2");
        taker = new MockTaker(AQUA, router, address(this));
        (yes,) = MARKET.wrappedOutcome(0);
    }

    function _order() internal view returns (ISwapVM.Order memory) {
        Program memory p = ProgramBuilder.init(_opcodes());
        bytes memory program = bytes.concat(
            p.build(
                _onlyUnresolvedCondition,
                OnlyUnresolvedConditionArgsBuilder.build(CONDITIONAL_TOKENS, MARKET.conditionId())
            ),
            p.build(_deadline, ControlsArgsBuilder.buildDeadline(uint40(block.timestamp + 1 days))),
            p.build(_fixedPriceSwap, FixedPriceSwapArgsBuilder.build(address(yes), address(SUSDS), PRICE)),
            p.build(_salt, ControlsArgsBuilder.buildSalt(uint64(1)))
        );
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

    function _takerData(bool isExactIn) internal view returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: address(taker),
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

    function _ship(ISwapVM.Order memory order) internal returns (bytes32 strategyHash) {
        deal(address(SUSDS), maker, CAP);
        address[] memory tokens = new address[](2);
        tokens[0] = address(yes);
        tokens[1] = address(SUSDS);
        uint256[] memory amounts = new uint256[](2);
        amounts[1] = CAP;
        vm.startPrank(maker);
        SUSDS.approve(address(AQUA), type(uint256).max);
        strategyHash = AQUA.ship(address(router), abi.encode(order), tokens, amounts);
        vm.stopPrank();
    }

    /// The taker gets YES the way a real counterparty would: splitting sUSDS on Seer.
    function _giveTakerYes(uint256 amount) internal {
        deal(address(SUSDS), address(this), amount);
        SUSDS.approve(address(SEER_ROUTER), amount);
        SEER_ROUTER.splitPosition(SUSDS, address(MARKET), amount);
        yes.transfer(address(taker), amount);
    }

    function test_gate_fillsAtFixedPriceExactIn() public {
        ISwapVM.Order memory order = _order();
        bytes32 strategyHash = _ship(order);
        assertEq(strategyHash, router.hash(order), "Aqua strategy hash == router order hash");

        _giveTakerYes(100e18);
        (uint256 qIn, uint256 qOut,) = router.quote(order, address(yes), address(SUSDS), 100e18, _takerData(true));
        assertEq(qIn, 100e18);
        assertEq(qOut, 20e18, "quote: 100 YES at 0.20 -> 20 sUSDS");

        (uint256 amountIn, uint256 amountOut) =
            taker.swap(order, address(yes), address(SUSDS), 100e18, _takerData(true));
        assertEq(amountIn, 100e18);
        assertEq(amountOut, 20e18);

        assertEq(yes.balanceOf(maker), 100e18, "maker receives the YES in their wallet");
        assertEq(SUSDS.balanceOf(maker), CAP - 20e18, "maker pays exactly the price");
        assertEq(SUSDS.balanceOf(address(taker)), 20e18);
        (uint248 left,) = AQUA.rawBalances(maker, address(router), strategyHash, address(SUSDS));
        assertEq(left, CAP - 20e18, "the cap shrinks by what was paid");
    }

    function test_gate_fillsAtFixedPriceExactOut() public {
        ISwapVM.Order memory order = _order();
        _ship(order);
        _giveTakerYes(100e18);
        (uint256 qIn, uint256 qOut,) = router.quote(order, address(yes), address(SUSDS), 20e18, _takerData(false));
        assertEq(qIn, 100e18, "quote: 20 sUSDS out needs 100 YES in");
        assertEq(qOut, 20e18);
        taker.swap(order, address(yes), address(SUSDS), 20e18, _takerData(false));
        assertEq(yes.balanceOf(maker), 100e18);
        assertEq(SUSDS.balanceOf(maker), CAP - 20e18);
    }
}
