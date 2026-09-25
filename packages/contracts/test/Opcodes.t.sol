// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { Context, SwapQuery, SwapRegisters } from "@1inch/swap-vm/src/libs/VM.sol";
import { FixedPriceSwap, FixedPriceSwapArgsBuilder } from "../src/instructions/FixedPriceSwap.sol";
import {
    OnlyUnresolvedCondition,
    OnlyUnresolvedConditionArgsBuilder
} from "../src/instructions/OnlyUnresolvedCondition.sol";

contract ConditionalTokensMock {
    mapping(bytes32 => uint256) public payoutDenominator;

    function report(bytes32 conditionId) external {
        payoutDenominator[conditionId] = 1;
    }
}

/// Exposes the two internal instructions with a hand-built Context.
contract OpcodesHarness is FixedPriceSwap, OnlyUnresolvedCondition {
    function fixedPriceSwap(
        SwapQuery memory query,
        SwapRegisters memory swap,
        bytes calldata args
    )
        external
        pure
        returns (SwapRegisters memory)
    {
        Context memory ctx;
        ctx.query = query;
        ctx.swap = swap;
        _fixedPriceSwap(ctx, args);
        return ctx.swap;
    }

    function onlyUnresolvedCondition(bytes calldata args) external view {
        Context memory ctx;
        _onlyUnresolvedCondition(ctx, args);
    }
}

contract OpcodesTest is Test {
    OpcodesHarness harness = new OpcodesHarness();
    address constant YES = address(0xAAAA);
    address constant COLLATERAL = address(0xBBBB);

    function _query(address tokenIn, address tokenOut, bool isExactIn) internal pure returns (SwapQuery memory q) {
        q.tokenIn = tokenIn;
        q.tokenOut = tokenOut;
        q.isExactIn = isExactIn;
    }

    function _exactIn(uint256 amountIn) internal pure returns (SwapRegisters memory s) {
        s.amountIn = amountIn;
    }

    function _exactOut(uint256 amountOut) internal pure returns (SwapRegisters memory s) {
        s.amountOut = amountOut;
    }

    // ── FixedPriceSwap ────────────────────────────────────────────────────

    function test_exactIn_paysAmountTimesPrice() public view {
        SwapRegisters memory s = harness.fixedPriceSwap(
            _query(YES, COLLATERAL, true), _exactIn(100e18), FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
        assertEq(s.amountOut, 20e18);
    }

    function test_exactOut_asksAmountOverPrice() public view {
        SwapRegisters memory s = harness.fixedPriceSwap(
            _query(YES, COLLATERAL, false), _exactOut(20e18), FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
        assertEq(s.amountIn, 100e18);
    }

    /// The maker never pays more than `price` per token, whatever the amounts.
    function testFuzz_makerNeverPaysMoreThanPrice(uint256 amount, uint256 price, bool isExactIn) public view {
        amount = bound(amount, 1, 1e30);
        price = bound(price, 1, 1e18);
        bytes memory args = FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, price);
        SwapRegisters memory s = isExactIn
            ? harness.fixedPriceSwap(_query(YES, COLLATERAL, true), _exactIn(amount), args)
            : harness.fixedPriceSwap(_query(YES, COLLATERAL, false), _exactOut(amount), args);
        // paid / received <= price  <=>  amountOut * 1e18 <= amountIn * price
        assertLe(s.amountOut * 1e18, s.amountIn * price);
    }

    function test_revert_wrongTokenIn() public {
        vm.expectRevert(
            abi.encodeWithSelector(FixedPriceSwap.FixedPriceSwapWrongDirection.selector, COLLATERAL, COLLATERAL)
        );
        harness.fixedPriceSwap(
            _query(COLLATERAL, COLLATERAL, true),
            _exactIn(1e18),
            FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
    }

    function test_revert_oppositeDirection() public {
        vm.expectRevert(abi.encodeWithSelector(FixedPriceSwap.FixedPriceSwapWrongDirection.selector, COLLATERAL, YES));
        harness.fixedPriceSwap(
            _query(COLLATERAL, YES, true), _exactIn(1e18), FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
    }

    function test_revert_wrongTokenOut() public {
        vm.expectRevert(abi.encodeWithSelector(FixedPriceSwap.FixedPriceSwapWrongDirection.selector, YES, YES));
        harness.fixedPriceSwap(
            _query(YES, YES, true), _exactIn(1e18), FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
    }

    function test_revert_zeroPrice() public {
        vm.expectRevert(FixedPriceSwap.FixedPriceSwapZeroPrice.selector);
        harness.fixedPriceSwap(
            _query(YES, COLLATERAL, true), _exactIn(1e18), FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0)
        );
    }

    function test_revert_recomputeExactIn() public {
        SwapRegisters memory s = _exactIn(1e18);
        s.amountOut = 1;
        vm.expectRevert(FixedPriceSwap.FixedPriceSwapRecomputeDetected.selector);
        harness.fixedPriceSwap(
            _query(YES, COLLATERAL, true), s, FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
    }

    function test_revert_recomputeExactOut() public {
        SwapRegisters memory s = _exactOut(1e18);
        s.amountIn = 1;
        vm.expectRevert(FixedPriceSwap.FixedPriceSwapRecomputeDetected.selector);
        harness.fixedPriceSwap(
            _query(YES, COLLATERAL, false), s, FixedPriceSwapArgsBuilder.build(YES, COLLATERAL, 0.2e18)
        );
    }

    function test_revert_missingArgs() public {
        vm.expectRevert(FixedPriceSwapArgsBuilder.FixedPriceSwapMissingArgs.selector);
        harness.fixedPriceSwap(_query(YES, COLLATERAL, true), _exactIn(1e18), abi.encodePacked(YES));
    }

    // ── OnlyUnresolvedCondition ───────────────────────────────────────────

    function test_unresolvedCondition_passes() public {
        ConditionalTokensMock ct = new ConditionalTokensMock();
        harness.onlyUnresolvedCondition(OnlyUnresolvedConditionArgsBuilder.build(address(ct), bytes32("c")));
    }

    function test_revert_resolvedCondition() public {
        ConditionalTokensMock ct = new ConditionalTokensMock();
        ct.report(bytes32("c"));
        vm.expectRevert(abi.encodeWithSelector(OnlyUnresolvedCondition.ConditionAlreadyResolved.selector, bytes32("c")));
        harness.onlyUnresolvedCondition(OnlyUnresolvedConditionArgsBuilder.build(address(ct), bytes32("c")));
    }

    function test_revert_unresolvedMissingArgs() public {
        vm.expectRevert(OnlyUnresolvedConditionArgsBuilder.OnlyUnresolvedConditionMissingArgs.selector);
        harness.onlyUnresolvedCondition(abi.encodePacked(address(1)));
    }
}
