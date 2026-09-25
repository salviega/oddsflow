// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice The parts of Seer's contracts on Base that OddsFlow calls.
interface ISeerRouter {
    /// @dev Pulls `amount` collateral from the caller and sends it one wrapped
    ///      ERC20 of every outcome, including "invalid result".
    function splitPosition(IERC20 collateralToken, address market, uint256 amount) external;
}

interface ISeerMarket {
    function conditionId() external view returns (bytes32);
    function numOutcomes() external view returns (uint256);
    function wrappedOutcome(uint256 index) external view returns (IERC20 wrapped1155, bytes memory data);
}

interface IConditionalTokens {
    /// @dev Zero until the condition's payouts are reported.
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);
}
