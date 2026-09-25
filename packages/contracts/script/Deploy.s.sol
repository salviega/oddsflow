// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { OddsFlowRouter } from "../src/OddsFlowRouter.sol";
import { OddsFlowTaker } from "../src/OddsFlowTaker.sol";
import { ISeerRouter } from "../src/interfaces/ISeer.sol";

/// Deploys OddsFlowRouter and OddsFlowTaker on Base and writes their addresses
/// to deployments/<chainid>.json.
///
/// The router is Ownable only for SwapVM's `rescueFunds`, which can move tokens
/// stuck in the router itself — never a maker's, which stay in their wallets
/// until Aqua pulls them. Ownership is renounced in the same run, so nobody
/// holds any power over the router after deployment.
contract Deploy is Script {
    address constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant SUSDS = 0x5875eEE11Cf8398102FdAd704C9E96607675467a;
    address constant SEER_ROUTER = 0x3124e97ebF4c9592A17d40E54623953Ff3c77a73;

    function run() external returns (OddsFlowRouter router, OddsFlowTaker taker) {
        vm.startBroadcast();
        router = new OddsFlowRouter(AQUA, WETH, msg.sender, "OddsFlow SwapVM", "1.0.2");
        router.renounceOwnership();
        taker = new OddsFlowTaker(IAqua(AQUA), ISwapVM(address(router)), IERC20(SUSDS), ISeerRouter(SEER_ROUTER));
        vm.stopBroadcast();

        require(router.owner() == address(0), "router ownership not renounced");

        string memory json = "deployment";
        vm.serializeAddress(json, "router", address(router));
        vm.serializeAddress(json, "taker", address(taker));
        string memory out = vm.serializeUint(json, "block", block.number);
        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));

        console.log("OddsFlowRouter:", address(router));
        console.log("OddsFlowTaker: ", address(taker));
        console.log("block:         ", block.number);
    }
}
