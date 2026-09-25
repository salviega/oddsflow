// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MockTaker } from "@1inch/swap-vm/test/mocks/MockTaker.sol";
import { ForkBase } from "./ForkBase.sol";

/// Phase 0 gate (spec/definicion/07): an order shipped on the official Aqua for a
/// redeployed router with FixedPriceSwap fills at exactly its price, in quote and
/// swap, against a real Seer market on a Gnosis fork.
contract GateForkTest is ForkBase {
    uint256 constant CAP = 1000e18;
    address maker = makeAddr("maker");
    MockTaker mockTaker;

    function setUp() public override {
        super.setUp();
        mockTaker = new MockTaker(AQUA, router, address(this));
        _fund(maker, CAP);
        _split(address(this), 100e18);
        yes.transfer(address(mockTaker), 100e18);
    }

    function test_gate_fillsAtFixedPriceExactIn() public {
        ISwapVM.Order memory order = _order(maker, yes, 0.2e18);
        bytes32 strategyHash = _ship(order, yes, CAP);
        assertEq(strategyHash, router.hash(order), "Aqua strategy hash == router order hash");

        bytes memory data = _takerData(address(mockTaker), true);
        (uint256 qIn, uint256 qOut,) = router.quote(order, address(yes), address(COLLATERAL), 100e18, data);
        assertEq(qIn, 100e18);
        assertEq(qOut, 20e18, "quote: 100 YES at 0.20 -> 20 sUSDS");

        (uint256 amountIn, uint256 amountOut) = mockTaker.swap(order, address(yes), address(COLLATERAL), 100e18, data);
        assertEq(amountIn, 100e18);
        assertEq(amountOut, 20e18);
        assertEq(yes.balanceOf(maker), 100e18, "maker receives the YES in their wallet");
        assertEq(COLLATERAL.balanceOf(maker), CAP - 20e18, "maker pays exactly the price");
        (uint248 left,) = AQUA.rawBalances(maker, address(router), strategyHash, address(COLLATERAL));
        assertEq(left, CAP - 20e18, "the cap shrinks by what was paid");
    }

    function test_gate_fillsAtFixedPriceExactOut() public {
        ISwapVM.Order memory order = _order(maker, yes, 0.2e18);
        _ship(order, yes, CAP);
        bytes memory data = _takerData(address(mockTaker), false);
        (uint256 qIn, uint256 qOut,) = router.quote(order, address(yes), address(COLLATERAL), 20e18, data);
        assertEq(qIn, 100e18, "quote: 20 sUSDS out needs 100 YES in");
        assertEq(qOut, 20e18);
        mockTaker.swap(order, address(yes), address(COLLATERAL), 20e18, data);
        assertEq(yes.balanceOf(maker), 100e18);
        assertEq(COLLATERAL.balanceOf(maker), CAP - 20e18);
    }
}
