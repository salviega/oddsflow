// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Calldata } from "@1inch/solidity-utils/contracts/libraries/Calldata.sol";
import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { IRealityETH } from "../interfaces/ISeer.sol";

library OnlyUnansweredQuestionArgsBuilder {
    using Calldata for bytes;

    error OnlyUnansweredQuestionMissingArgs();

    function build(address realitio, bytes32 questionId) internal pure returns (bytes memory) {
        return abi.encodePacked(realitio, questionId);
    }

    function parse(bytes calldata args) internal pure returns (address realitio, bytes32 questionId) {
        realitio = address(bytes20(args.slice(0, 20, OnlyUnansweredQuestionMissingArgs.selector)));
        questionId = bytes32(args.slice(20, 52, OnlyUnansweredQuestionMissingArgs.selector));
    }
}

/// @title OnlyUnansweredQuestion
/// @notice Reverts as soon as anyone posts an answer to the market's Reality.eth
///   question. A posted answer is a strong signal of the outcome days before it
///   is final, so an order that kept filling would sell its maker a result that
///   is already known. Seer markets open to answers long before their event, so
///   this is what protects makers, not the opening time.
/// @dev Reality.eth keeps finalize_ts at 0 until the first answer.
contract OnlyUnansweredQuestion {
    error QuestionAlreadyAnswered(bytes32 questionId);

    /// @param args.realitio   | 20 bytes
    /// @param args.questionId | 32 bytes
    function _onlyUnansweredQuestion(Context memory, bytes calldata args) internal view {
        (address realitio, bytes32 questionId) = OnlyUnansweredQuestionArgsBuilder.parse(args);
        if (IRealityETH(realitio).getFinalizeTS(questionId) != 0) {
            revert QuestionAlreadyAnswered(questionId);
        }
    }
}
