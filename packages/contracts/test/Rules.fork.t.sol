// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { SwapVM } from "@1inch/swap-vm/src/SwapVM.sol";
import { Controls } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { MockTaker } from "@1inch/swap-vm/test/mocks/MockTaker.sol";
import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { FixedPriceSwap } from "../src/instructions/FixedPriceSwap.sol";
import { OnlyUnresolvedCondition } from "../src/instructions/OnlyUnresolvedCondition.sol";
import { IConditionalTokens, ISeerMarket } from "../src/interfaces/ISeer.sol";
import { ForkBase } from "./ForkBase.sol";

/// A taker that takes the maker's sUSDS and pushes nothing back.
contract FreeloaderTaker is MockTaker {
    constructor(Aqua aqua, SwapVM swapVM) MockTaker(aqua, swapVM, msg.sender) { }

    function preTransferInCallback(
        address,
        address,
        address,
        address,
        uint256,
        uint256,
        bytes32,
        bytes calldata
    )
        public
        override
        onlySWAPVM_
    { }

    modifier onlySWAPVM_() {
        require(msg.sender == address(SWAPVM), "Not the SwapVM");
        _;
    }
}

/// spec/definicion/05 §5: the maker's sUSDS never leaves without their outcome
/// tokens, at the signed price. Each test tries to break it and expects a revert.
contract RulesForkTest is ForkBase {
    uint256 constant CAP = 1000e18;
    address maker = makeAddr("maker");
    MockTaker honest;
    ISwapVM.Order order;
    bytes32 strategyHash;

    function setUp() public override {
        super.setUp();
        honest = new MockTaker(AQUA, router, address(this));
        _fund(maker, CAP);
        order = _order(maker, yes, 0.2e18);
        strategyHash = _ship(order, yes, CAP);
        _split(address(this), 1000e18);
        yes.transfer(address(honest), 1000e18);
        no.transfer(address(honest), 1000e18);
        _fund(address(honest), 1000e18);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amount) internal returns (uint256, uint256) {
        return honest.swap(order, tokenIn, tokenOut, amount, _takerData(address(honest), true));
    }

    function test_rule_oppositeDirectionReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                FixedPriceSwap.FixedPriceSwapWrongDirection.selector, address(COLLATERAL), address(yes)
            )
        );
        _swap(address(COLLATERAL), address(yes), 10e18);
    }

    function test_rule_otherSideTokenReverts() public {
        vm.expectRevert();
        _swap(address(no), address(COLLATERAL), 10e18);
    }

    function test_rule_overTheCapReverts() public {
        ISwapVM.Order memory small = _order(maker, yes, 0.2e18);
        _ship(small, yes, 10e18); // pays at most 10 sUSDS
        vm.expectRevert();
        honest.swap(small, address(yes), address(COLLATERAL), 100e18, _takerData(address(honest), true)); // asks 20
    }

    function test_rule_takerMustDeliverTheToken() public {
        FreeloaderTaker freeloader = new FreeloaderTaker(AQUA, router);
        vm.expectRevert(abi.encodeWithSelector(SwapVM.AquaBalanceInsufficientAfterTakerPush.selector, 0, 0, 100e18, 0));
        vm.prank(address(this));
        freeloader.swap(order, address(yes), address(COLLATERAL), 100e18, _takerData(address(freeloader), true));
        assertEq(COLLATERAL.balanceOf(maker), CAP, "maker keeps every sUSDS");
    }

    function test_rule_nothingAfterTheDeadline() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(abi.encodeWithSelector(Controls.DeadlineReached.selector, address(honest), block.timestamp - 1));
        _swap(address(yes), address(COLLATERAL), 10e18);
    }

    function test_rule_nothingOnceResolved() public {
        bytes32 conditionId = ISeerMarket(MARKET).conditionId();
        vm.mockCall(
            CONDITIONAL_TOKENS,
            abi.encodeWithSelector(IConditionalTokens.payoutDenominator.selector, conditionId),
            abi.encode(uint256(1))
        );
        vm.expectRevert(abi.encodeWithSelector(OnlyUnresolvedCondition.ConditionAlreadyResolved.selector, conditionId));
        _swap(address(yes), address(COLLATERAL), 10e18);
    }

    function test_rule_othersCannotCancelTheOrder() public {
        address attacker = makeAddr("attacker");
        address[] memory tokens = new address[](2);
        tokens[0] = address(yes);
        tokens[1] = address(COLLATERAL);
        vm.prank(attacker);
        try AQUA.dock(address(router), strategyHash, tokens) { } catch { }
        (uint256 amountIn,) = _swap(address(yes), address(COLLATERAL), 10e18);
        assertEq(amountIn, 10e18, "the maker's order still fills");
    }

    function test_rule_cancelledOrderCannotFill() public {
        address[] memory tokens = new address[](2);
        tokens[0] = address(yes);
        tokens[1] = address(COLLATERAL);
        vm.prank(maker);
        AQUA.dock(address(router), strategyHash, tokens);
        vm.expectRevert();
        _swap(address(yes), address(COLLATERAL), 10e18);
        assertEq(COLLATERAL.balanceOf(maker), CAP);
    }
}
