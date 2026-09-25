// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { ForkBase } from "./ForkBase.sol";

/// spec/definicion/05 §6: how much gas a buy costs as it sweeps more orders.
contract GasForkTest is ForkBase {
    address carol = makeAddr("carol");

    function _measure(uint256 count) internal returns (uint256 gasUsed) {
        ISwapVM.Order[] memory orders = new ISwapVM.Order[](count);
        for (uint256 i = 0; i < count; i++) {
            address maker = makeAddr(string.concat("maker", vm.toString(i)));
            _fund(maker, 10e18);
            orders[i] = _order(maker, yes, 0.2e18);
            _ship(orders[i], yes, 10e18); // each covers 50 tokens
        }
        _fund(carol, 1000e18);
        vm.prank(carol);
        COLLATERAL.approve(address(taker), type(uint256).max);

        uint256 wanted = count * 50e18;
        vm.prank(carol);
        uint256 before = gasleft();
        (uint256 bought,) = taker.buy(MARKET, NO, orders, wanted, wanted, type(uint256).max);
        gasUsed = before - gasleft();
        assertEq(bought, wanted);
    }

    function test_gas_buySweepingOneOrder() public {
        emit log_named_uint("1 order ", _measure(1));
    }

    function test_gas_buySweepingThreeOrders() public {
        emit log_named_uint("3 orders", _measure(3));
    }

    function test_gas_buySweepingFiveOrders() public {
        emit log_named_uint("5 orders", _measure(5));
    }

    function test_gas_buySweepingTenOrders() public {
        emit log_named_uint("10 orders", _measure(10));
    }
}
