// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { ITakerCallbacks } from "@1inch/swap-vm/src/interfaces/ITakerCallbacks.sol";
import { TakerTraitsLib } from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import { ISeerMarket, ISeerRouter } from "./interfaces/ISeer.sol";

/// @title OddsFlowTaker
/// @notice The counterparty's side of OddsFlow, in one transaction:
///   - `buy`: fills OddsFlow orders for the opposite side by minting. Each order's
///     maker pays `n * price` sUSDS, the buyer pays the rest, Seer splits `n` sUSDS
///     into both sides plus "invalid result", the maker gets their side and the
///     buyer gets the other. Invalid-result tokens are shared by contribution.
///   - `sell`: sells outcome tokens the caller already holds to OddsFlow orders.
/// @dev Holds no funds between transactions and has no owner. Makers never
///   approve it: their sUSDS reaches it only through Aqua, pulled by the router
///   under the order's own program.
contract OddsFlowTaker is ITakerCallbacks {
    using SafeERC20 for IERC20;

    uint8 private constant _IDLE = 0;
    uint8 private constant _BUYING = 1;
    uint8 private constant _SELLING = 2;

    IAqua public immutable AQUA;
    ISwapVM public immutable ROUTER;
    IERC20 public immutable COLLATERAL;
    ISeerRouter public immutable SEER_ROUTER;

    // State of the operation in progress, readable by the router callback.
    uint8 private transient _mode;
    address private transient _account;
    address private transient _market;
    IERC20 private transient _counterToken;
    IERC20 private transient _invalidToken;

    event Bought(address indexed buyer, address indexed market, uint256 side, uint256 amount, uint256 spent);
    event Sold(address indexed seller, address indexed market, uint256 side, uint256 amount, uint256 received);

    error NotRouter();
    error NoOperationInProgress();
    error OperationInProgress();
    error InvalidSide(uint256 side);
    error BelowMinimum(uint256 amount, uint256 minimum);
    error AboveMaximum(uint256 amount, uint256 maximum);

    constructor(IAqua aqua, ISwapVM router, IERC20 collateral, ISeerRouter seerRouter) {
        AQUA = aqua;
        ROUTER = router;
        COLLATERAL = collateral;
        SEER_ROUTER = seerRouter;
    }

    /// @notice Buys `amount` tokens of `side` (0 = YES, 1 = NO) from orders for
    ///   the other side, best first. Orders that cannot pay anything are skipped.
    /// @param orders   OddsFlow orders buying the opposite side, sorted best first
    /// @param minAmount fewest tokens of `side` the buyer accepts
    /// @param maxSpend  most sUSDS the buyer accepts to pay
    function buy(
        address market,
        uint256 side,
        ISwapVM.Order[] calldata orders,
        uint256 amount,
        uint256 minAmount,
        uint256 maxSpend
    )
        external
        returns (uint256 bought, uint256 spent)
    {
        (IERC20 makerToken, IERC20 counterToken, IERC20 invalidToken) = _tokens(market, side);
        _begin(_BUYING, market, counterToken, invalidToken);

        for (uint256 i = 0; i < orders.length && bought < amount; i++) {
            (uint256 n, uint256 makerPays) = _fill(orders[i], makerToken, amount - bought);
            bought += n;
            spent += n - makerPays;
        }

        _end();
        if (bought < minAmount) {
            revert BelowMinimum(bought, minAmount);
        }
        if (spent > maxSpend) {
            revert AboveMaximum(spent, maxSpend);
        }
        emit Bought(msg.sender, market, side, bought, spent);
    }

    /// @notice Sells up to `amount` tokens of `side` the caller holds to orders
    ///   buying that side, best first.
    /// @param orders      OddsFlow orders buying `side`, sorted best first
    /// @param minReceived least sUSDS the seller accepts
    function sell(
        address market,
        uint256 side,
        ISwapVM.Order[] calldata orders,
        uint256 amount,
        uint256 minReceived
    )
        external
        returns (uint256 sold, uint256 received)
    {
        if (side > 1) {
            revert InvalidSide(side);
        }
        // Orders buying `side` take the seller's own token as tokenIn.
        (IERC20 ownToken,,) = _tokens(market, 1 - side);
        _begin(_SELLING, market, ownToken, IERC20(address(0)));

        for (uint256 i = 0; i < orders.length && sold < amount; i++) {
            (uint256 n, uint256 makerPays) = _fill(orders[i], ownToken, amount - sold);
            sold += n;
            received += makerPays;
        }

        _end();
        if (received < minReceived) {
            revert BelowMinimum(received, minReceived);
        }
        if (received > 0) {
            COLLATERAL.safeTransfer(msg.sender, received);
        }
        emit Sold(msg.sender, market, side, sold, received);
    }

    /// @dev Called by the router after it moved the maker's sUSDS here and before
    ///   it checks that `amountIn` of the maker's token reached the maker.
    function preTransferInCallback(
        address maker,
        address,
        address tokenIn,
        address,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 orderHash,
        bytes calldata
    )
        external
    {
        if (msg.sender != address(ROUTER)) {
            revert NotRouter();
        }
        uint8 mode = _mode;
        if (mode == _IDLE) {
            revert NoOperationInProgress();
        }

        if (mode == _BUYING) {
            uint256 buyerPays = amountIn - amountOut;
            COLLATERAL.safeTransferFrom(_account, address(this), buyerPays);
            COLLATERAL.forceApprove(address(SEER_ROUTER), amountIn);
            SEER_ROUTER.splitPosition(COLLATERAL, _market, amountIn);
            _counterToken.safeTransfer(_account, amountIn);
            _invalidToken.safeTransfer(maker, amountOut);
            _invalidToken.safeTransfer(_account, buyerPays);
        } else {
            IERC20(tokenIn).safeTransferFrom(_account, address(this), amountIn);
        }

        IERC20(tokenIn).forceApprove(address(AQUA), amountIn);
        AQUA.push(maker, address(ROUTER), orderHash, tokenIn, amountIn);
    }

    function preTransferOutCallback(
        address,
        address,
        address,
        address,
        uint256,
        uint256,
        bytes32,
        bytes calldata
    )
        external
        pure
    { }

    /// @dev Fills one order for up to `wanted` of `makerToken`, capped to what the
    ///   maker can pay today. Returns (0, 0) instead of reverting when it cannot.
    function _fill(
        ISwapVM.Order calldata order,
        IERC20 makerToken,
        uint256 wanted
    )
        private
        returns (uint256 n, uint256 makerPays)
    {
        bytes32 orderHash = ROUTER.hash(order);
        uint256 available = _available(order.maker, orderHash);
        if (available == 0) {
            return (0, 0);
        }
        bytes memory takerData = _takerData();

        try ROUTER.quote(order, address(makerToken), address(COLLATERAL), wanted, takerData) returns (
            uint256, uint256 quotedOut, bytes32
        ) {
            n = wanted;
            if (quotedOut > available) {
                // Scale down to what the maker can pay. With q = floor(wanted * p),
                // q >= wanted * p - 1, so n * p <= available * (q + 1) / q, which is
                // < available + 1 because available < q: the fill never overshoots.
                n = wanted * available / quotedOut;
            }
        } catch {
            return (0, 0);
        }

        try ROUTER.swap(order, address(makerToken), address(COLLATERAL), n, takerData) returns (
            uint256, uint256 amountOut, bytes32
        ) {
            makerPays = amountOut;
        } catch {
            return (0, 0);
        }
    }

    /// @dev The least of the order's remaining cap, the maker's balance and the
    ///   maker's approval to Aqua: what a fill can take without reverting.
    function _available(address maker, bytes32 orderHash) private view returns (uint256 available) {
        (uint248 cap,) = AQUA.rawBalances(maker, address(ROUTER), orderHash, address(COLLATERAL));
        available = cap;
        uint256 balance = COLLATERAL.balanceOf(maker);
        if (balance < available) {
            available = balance;
        }
        uint256 allowance = COLLATERAL.allowance(maker, address(AQUA));
        if (allowance < available) {
            available = allowance;
        }
    }

    function _tokens(
        address market,
        uint256 side
    )
        private
        view
        returns (IERC20 makerToken, IERC20 counterToken, IERC20 invalidToken)
    {
        if (side > 1) {
            revert InvalidSide(side);
        }
        (counterToken,) = ISeerMarket(market).wrappedOutcome(side);
        (makerToken,) = ISeerMarket(market).wrappedOutcome(1 - side);
        (invalidToken,) = ISeerMarket(market).wrappedOutcome(2);
    }

    function _begin(uint8 mode, address market, IERC20 counterToken, IERC20 invalidToken) private {
        if (_mode != _IDLE) {
            revert OperationInProgress();
        }
        _mode = mode;
        _account = msg.sender;
        _market = market;
        _counterToken = counterToken;
        _invalidToken = invalidToken;
    }

    function _end() private {
        _mode = _IDLE;
    }

    function _takerData() private view returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: address(this),
                isExactIn: true,
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
}
