// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Calldata } from "@1inch/solidity-utils/contracts/libraries/Calldata.sol";
import { Context } from "@1inch/swap-vm/src/libs/VM.sol";

library FixedPriceSwapArgsBuilder {
    using Calldata for bytes;

    error FixedPriceSwapMissingArgs();

    /// @param price tokenOut paid per unit of tokenIn, scaled by 1e18
    function build(address tokenIn, address tokenOut, uint256 price) internal pure returns (bytes memory) {
        return abi.encodePacked(tokenIn, tokenOut, price);
    }

    function parse(bytes calldata args) internal pure returns (address tokenIn, address tokenOut, uint256 price) {
        tokenIn = address(bytes20(args.slice(0, 20, FixedPriceSwapMissingArgs.selector)));
        tokenOut = address(bytes20(args.slice(20, 40, FixedPriceSwapMissingArgs.selector)));
        price = uint256(bytes32(args.slice(40, 72, FixedPriceSwapMissingArgs.selector)));
    }
}

/// @title FixedPriceSwap
/// @notice A limit order price for Aqua strategies: the price is an argument of
///   the instruction, not a ratio of the balance registers. LimitSwap derives its
///   price from balanceOut / balanceIn, which on Aqua's live virtual balances
///   reverts for a fresh order (balanceIn == 0) and drifts on every fill.
/// @dev The order's cap is the Aqua virtual balance of tokenOut: Aqua.pull reverts
///   past it. Rounding always favours the maker.
contract FixedPriceSwap {
    error FixedPriceSwapWrongDirection(address tokenIn, address tokenOut);
    error FixedPriceSwapZeroPrice();
    error FixedPriceSwapRecomputeDetected();

    /// @param args.tokenIn  | 20 bytes — the only token the maker accepts
    /// @param args.tokenOut | 20 bytes — the only token the maker pays
    /// @param args.price    | 32 bytes — tokenOut per tokenIn, 1e18 scale
    function _fixedPriceSwap(Context memory ctx, bytes calldata args) internal pure {
        (address tokenIn, address tokenOut, uint256 price) = FixedPriceSwapArgsBuilder.parse(args);
        if (ctx.query.tokenIn != tokenIn || ctx.query.tokenOut != tokenOut) {
            revert FixedPriceSwapWrongDirection(ctx.query.tokenIn, ctx.query.tokenOut);
        }
        if (price == 0) {
            revert FixedPriceSwapZeroPrice();
        }

        if (ctx.query.isExactIn) {
            if (ctx.swap.amountOut != 0) {
                revert FixedPriceSwapRecomputeDetected();
            }
            ctx.swap.amountOut = Math.mulDiv(ctx.swap.amountIn, price, 1e18); // floor: maker pays less
        } else {
            if (ctx.swap.amountIn != 0) {
                revert FixedPriceSwapRecomputeDetected();
            }
            ctx.swap.amountIn = Math.mulDiv(ctx.swap.amountOut, 1e18, price, Math.Rounding.Ceil); // ceil: maker receives more
        }
    }
}
