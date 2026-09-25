// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { OddsFlowTaker } from "../src/OddsFlowTaker.sol";
import { ForkBase } from "./ForkBase.sol";

/// A maker hook that tries to start a second operation mid-fill.
contract ReentrantHook {
    OddsFlowTaker immutable taker;
    address immutable market;
    bytes public lastRevert;

    constructor(OddsFlowTaker taker_, address market_) {
        taker = taker_;
        market = market_;
    }

    function preTransferIn(
        address,
        address,
        address,
        address,
        uint256,
        uint256,
        bytes32,
        bytes calldata,
        bytes calldata
    )
        external
    {
        try taker.buy(market, 1, new ISwapVM.Order[](0), 1, 0, 0) { }
        catch (bytes memory reason) {
            lastRevert = reason;
        }
    }
}

contract OddsFlowTakerForkTest is ForkBase {
    address alice = makeAddr("alice"); // maker
    address bob = makeAddr("bob"); // maker
    address carol = makeAddr("carol"); // buyer / seller

    function _buyer(uint256 amount) internal {
        _fund(carol, amount);
        vm.prank(carol);
        SUSDS.approve(address(taker), type(uint256).max);
    }

    function _buy(
        ISwapVM.Order[] memory orders,
        uint256 amount,
        uint256 minAmount,
        uint256 maxSpend
    )
        internal
        returns (uint256 bought, uint256 spent)
    {
        vm.prank(carol);
        return taker.buy(MARKET, NO, orders, amount, minAmount, maxSpend);
    }

    // ── buy: the mint path ────────────────────────────────────────────────

    function test_buy_mintsBothSidesAndSharesInvalid() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _buyer(100e18);

        (uint256 bought, uint256 spent) = _buy(_one(order), 100e18, 100e18, 80e18);

        assertEq(bought, 100e18);
        assertEq(spent, 80e18, "NO at 0.80 when YES is at 0.20");
        assertEq(no.balanceOf(carol), 100e18, "buyer gets NO");
        assertEq(yes.balanceOf(alice), 100e18, "maker gets YES");
        assertEq(SUSDS.balanceOf(alice), 980e18, "maker paid 20");
        assertEq(SUSDS.balanceOf(carol), 20e18, "buyer paid 80");
        assertEq(invalid.balanceOf(alice), 20e18, "invalid by contribution: maker");
        assertEq(invalid.balanceOf(carol), 80e18, "invalid by contribution: buyer");
        _assertTakerEmpty();
    }

    function test_buy_sweepsOrdersBestFirst() public {
        _fund(alice, 1000e18);
        _fund(bob, 1000e18);
        ISwapVM.Order memory best = _order(alice, yes, 0.25e18); // NO at 0.75
        ISwapVM.Order memory next = _order(bob, yes, 0.2e18); // NO at 0.80
        _ship(best, yes, 10e18); // covers 40 tokens
        _ship(next, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought, uint256 spent) = _buy(_two(best, next), 100e18, 100e18, type(uint256).max);

        assertEq(bought, 100e18);
        assertEq(yes.balanceOf(alice), 40e18, "best order filled to its cap");
        assertEq(yes.balanceOf(bob), 60e18, "the rest from the next one");
        assertEq(spent, 40e18 * 75 / 100 + 60e18 * 80 / 100);
        _assertTakerEmpty();
    }

    /// Two orders share one balance: filling one lowers what the other can cover.
    function test_buy_sharedBalanceCapsTheSecondOrder() public {
        _fund(alice, 50e18);
        ISwapVM.Order memory first = _order(alice, yes, 0.2e18);
        ISwapVM.Order memory second = _order(alice, yes, 0.2e18);
        _ship(first, yes, 1000e18);
        _ship(second, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought,) = _buy(_two(first, second), 1000e18, 0, type(uint256).max);

        assertEq(bought, 250e18, "50 sUSDS at 0.20 covers 250 tokens, once");
        assertEq(SUSDS.balanceOf(alice), 0);
        _assertTakerEmpty();
    }

    function test_buy_capsToTheMakersBalance() public {
        _fund(alice, 30e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought, uint256 spent) = _buy(_one(order), 1000e18, 0, type(uint256).max);

        assertEq(bought, 150e18);
        assertEq(spent, 120e18);
        _assertTakerEmpty();
    }

    function test_buy_capsWithRoundingAtAnOddPrice() public {
        _fund(alice, 10e18 + 7);
        ISwapVM.Order memory order = _order(alice, yes, 0.3e18);
        _ship(order, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought,) = _buy(_one(order), 1000e18, 0, type(uint256).max);

        assertGt(bought, 0);
        assertLe(SUSDS.balanceOf(alice), 10e18 + 7);
        assertLe(bought * 0.3e18 / 1e18, 10e18 + 7, "never more than the maker holds");
        _assertTakerEmpty();
    }

    function test_buy_skipsAMakerWithoutFunds() public {
        _fund(bob, 1000e18);
        ISwapVM.Order memory empty = _order(alice, yes, 0.3e18); // alice has no sUSDS
        ISwapVM.Order memory funded = _order(bob, yes, 0.2e18);
        _ship(empty, yes, 1000e18);
        _ship(funded, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought,) = _buy(_two(empty, funded), 100e18, 100e18, type(uint256).max);

        assertEq(bought, 100e18);
        assertEq(yes.balanceOf(bob), 100e18);
    }

    function test_buy_skipsAnExpiredOrder() public {
        _fund(alice, 1000e18);
        _fund(bob, 1000e18);
        ISwapVM.Order memory expired = _order(alice, yes, 0.3e18, block.timestamp + 1);
        ISwapVM.Order memory live = _order(bob, yes, 0.2e18, block.timestamp + 1 days);
        _ship(expired, yes, 1000e18);
        _ship(live, yes, 1000e18);
        vm.warp(block.timestamp + 2);
        _buyer(1000e18);

        (uint256 bought,) = _buy(_two(expired, live), 100e18, 100e18, type(uint256).max);

        assertEq(bought, 100e18);
        assertEq(yes.balanceOf(alice), 0);
    }

    function test_buy_skipsWhenTheBuyerCannotPay() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        // carol approves but holds nothing: the fill reverts inside and is skipped

        vm.prank(carol);
        SUSDS.approve(address(taker), type(uint256).max);
        (uint256 bought, uint256 spent) = _buy(_one(order), 100e18, 0, type(uint256).max);

        assertEq(bought, 0);
        assertEq(spent, 0);
        assertEq(SUSDS.balanceOf(alice), 1000e18, "maker untouched");
    }

    function test_buy_revertsUnderTheMinimum() public {
        _fund(alice, 10e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _buyer(1000e18);
        vm.expectRevert(abi.encodeWithSelector(OddsFlowTaker.BelowMinimum.selector, 50e18, 100e18));
        _buy(_one(order), 100e18, 100e18, type(uint256).max);
    }

    function test_buy_revertsOverTheMaximumSpend() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _buyer(1000e18);
        vm.expectRevert(abi.encodeWithSelector(OddsFlowTaker.AboveMaximum.selector, 80e18, 79e18));
        _buy(_one(order), 100e18, 0, 79e18);
    }

    function test_buy_revertsOnAnInvalidSide() public {
        vm.expectRevert(abi.encodeWithSelector(OddsFlowTaker.InvalidSide.selector, 2));
        taker.buy(MARKET, 2, new ISwapVM.Order[](0), 1, 0, 0);
    }

    // ── sell: tokens the seller already holds ─────────────────────────────

    function test_sell_toAnOrder() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _split(carol, 100e18);
        vm.prank(carol);
        yes.approve(address(taker), type(uint256).max);

        vm.prank(carol);
        (uint256 sold, uint256 received) = taker.sell(MARKET, YES, _one(order), 100e18, 20e18);

        assertEq(sold, 100e18);
        assertEq(received, 20e18);
        assertEq(SUSDS.balanceOf(carol), 20e18);
        assertEq(yes.balanceOf(alice), 100e18);
        assertEq(no.balanceOf(carol), 100e18, "seller keeps the other side");
        _assertTakerEmpty();
    }

    function test_sell_revertsUnderTheMinimum() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        _split(carol, 100e18);
        vm.prank(carol);
        yes.approve(address(taker), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(OddsFlowTaker.BelowMinimum.selector, 20e18, 21e18));
        vm.prank(carol);
        taker.sell(MARKET, YES, _one(order), 100e18, 21e18);
    }

    function test_sell_nothingFilledSendsNothing() public {
        vm.prank(carol);
        (uint256 sold, uint256 received) = taker.sell(MARKET, YES, new ISwapVM.Order[](0), 100e18, 0);
        assertEq(sold, 0);
        assertEq(received, 0);
    }

    function test_sell_revertsOnAnInvalidSide() public {
        vm.expectRevert(abi.encodeWithSelector(OddsFlowTaker.InvalidSide.selector, 5));
        taker.sell(MARKET, 5, new ISwapVM.Order[](0), 1, 0);
    }

    // ── callback guards ───────────────────────────────────────────────────

    function test_callback_onlyFromTheRouter() public {
        vm.expectRevert(OddsFlowTaker.NotRouter.selector);
        taker.preTransferInCallback(alice, address(0), address(yes), address(SUSDS), 1, 1, bytes32(0), "");
    }

    function test_callback_onlyDuringAnOperation() public {
        vm.prank(address(router));
        vm.expectRevert(OddsFlowTaker.NoOperationInProgress.selector);
        taker.preTransferInCallback(alice, address(0), address(yes), address(SUSDS), 1, 1, bytes32(0), "");
    }

    function test_preTransferOutCallback_isANoOp() public view {
        taker.preTransferOutCallback(address(0), address(0), address(0), address(0), 0, 0, bytes32(0), "");
    }

    function test_buy_capsToTheMakersApproval() public {
        _fund(alice, 1000e18);
        ISwapVM.Order memory order = _order(alice, yes, 0.2e18);
        _ship(order, yes, 1000e18);
        vm.prank(alice);
        SUSDS.approve(address(AQUA), 10e18); // approval below balance and cap
        _buyer(1000e18);

        (uint256 bought,) = _buy(_one(order), 1000e18, 0, type(uint256).max);

        assertEq(bought, 50e18, "10 sUSDS approved at 0.20 covers 50 tokens");
        _assertTakerEmpty();
    }

    function test_buy_cannotBeReenteredMidFill() public {
        _fund(alice, 1000e18);
        ReentrantHook hook = new ReentrantHook(taker, MARKET);
        ISwapVM.Order memory order;
        // Same program, plus a pre-transfer-in hook that re-enters the taker.
        order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: alice,
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                receiver: address(0),
                hasPreTransferInHook: true,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(hook),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: _program(yes, 0.2e18, block.timestamp + 1 days)
            })
        );
        _ship(order, yes, 1000e18);
        _buyer(1000e18);

        (uint256 bought,) = _buy(_one(order), 100e18, 100e18, type(uint256).max);

        assertEq(bought, 100e18, "the outer fill completes");
        assertEq(hook.lastRevert(), abi.encodeWithSelector(OddsFlowTaker.OperationInProgress.selector));
        _assertTakerEmpty();
    }
}
