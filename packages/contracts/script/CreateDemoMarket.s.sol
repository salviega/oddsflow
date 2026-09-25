// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISeerMarket } from "../src/interfaces/ISeer.sol";

interface ISeerMarketFactory {
    struct CreateMarketParams {
        string marketName;
        string[] outcomes;
        string questionStart;
        string questionEnd;
        string outcomeType;
        uint256 parentOutcome;
        address parentMarket;
        string category;
        string lang;
        uint256 lowerBound;
        uint256 upperBound;
        uint256 minBond;
        uint32 openingTime;
        string[] tokenNames;
    }

    function createCategoricalMarket(CreateMarketParams calldata params) external returns (address);
}

/// Creates the binary demo market on Seer (Base). The question and opening time
/// come from DEMO_MARKET_NAME and DEMO_OPENING_TIME (unix seconds). Orders on
/// it must expire by the opening time, so it opens after the demo (spec 07).
/// Seer's factory on Base sets a 3.5-day answer timeout, so the market cannot
/// resolve before the hackathon closes: claiming is shown on a fork.
contract CreateDemoMarket is Script {
    ISeerMarketFactory constant FACTORY = ISeerMarketFactory(0x886Ef0A78faBbAE942F1dA1791A8ed02a5aF8BC6);
    uint256 constant MIN_BOND = 0.0005 ether; // Seer's own minimum on Base

    function run() external returns (address market) {
        string memory name = vm.envOr("DEMO_MARKET_NAME", string("Will OddsFlow win a prize at ETHGlobal Tokyo 2026?"));
        // Monday 28 September 2026, 00:00 JST
        uint32 openingTime = uint32(vm.envOr("DEMO_OPENING_TIME", uint256(1_790_521_200)));
        require(openingTime > block.timestamp, "opening time must be in the future");

        string[] memory outcomes = new string[](2);
        outcomes[0] = "Yes";
        outcomes[1] = "No";
        string[] memory tokenNames = new string[](2);
        tokenNames[0] = "YES";
        tokenNames[1] = "NO";

        vm.startBroadcast();
        market = FACTORY.createCategoricalMarket(
            ISeerMarketFactory.CreateMarketParams({
                marketName: name,
                outcomes: outcomes,
                questionStart: "",
                questionEnd: "",
                outcomeType: "",
                parentOutcome: 0,
                parentMarket: address(0),
                category: "misc",
                lang: "en_US",
                lowerBound: 0,
                upperBound: 0,
                minBond: MIN_BOND,
                openingTime: openingTime,
                tokenNames: tokenNames
            })
        );
        vm.stopBroadcast();

        (IERC20 yes,) = ISeerMarket(market).wrappedOutcome(0);
        (IERC20 no,) = ISeerMarket(market).wrappedOutcome(1);
        (IERC20 invalid,) = ISeerMarket(market).wrappedOutcome(2);
        console.log("market:     ", market);
        console.log("YES:        ", address(yes));
        console.log("NO:         ", address(no));
        console.log("invalid:    ", address(invalid));
        console.logBytes32(ISeerMarket(market).conditionId());
    }
}
