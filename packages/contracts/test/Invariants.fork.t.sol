// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { SwapVM } from "@1inch/swap-vm/src/SwapVM.sol";
import { MockTaker } from "@1inch/swap-vm/test/mocks/MockTaker.sol";
import { CoreInvariants } from "@1inch/swap-vm/test/invariants/CoreInvariants.t.sol";
import { ForkBase } from "./ForkBase.sol";

/// SwapVM's own invariant harness, run on an OddsFlow order: symmetry between
/// exact-in and exact-out, additivity, quote/swap consistency, rounding in the
/// maker's favour and balance sufficiency.
contract InvariantsForkTest is ForkBase, CoreInvariants {
    address maker = makeAddr("maker");
    MockTaker mockTaker;

    function setUp() public override {
        super.setUp();
        mockTaker = new MockTaker(AQUA, router, address(this));
        _split(address(this), 100_000e18);
        yes.transfer(address(mockTaker), 100_000e18);
    }

    function _executeSwap(
        SwapVM,
        ISwapVM.Order memory order,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes memory takerData
    )
        internal
        override
        returns (uint256 amountIn, uint256 amountOut)
    {
        return mockTaker.swap(order, tokenIn, tokenOut, amount, takerData);
    }

    function _config() internal view returns (InvariantConfig memory config) {
        config = _getDefaultConfig();
        config.skipMonotonicity = true; // a fixed price does not move with size
        config.exactInTakerData = _takerData(address(mockTaker), true);
        config.exactOutTakerData = _takerData(address(mockTaker), false);
    }

    function _check(uint256 price) internal {
        _fund(maker, 100_000e18);
        ISwapVM.Order memory order = _order(maker, yes, price);
        _ship(order, yes, 100_000e18);
        assertAllInvariantsWithConfig(router, order, address(yes), address(COLLATERAL), _config());
    }

    function test_invariants_atTwentyCents() public {
        _check(0.2e18);
    }

    function test_invariants_atAnOddPrice() public {
        _check(0.37e18);
    }

    function test_invariants_nearOne() public {
        _check(0.99e18);
    }
}
