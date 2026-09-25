// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { OddsFlowRouter } from "../src/OddsFlowRouter.sol";
import { OddsFlowTaker } from "../src/OddsFlowTaker.sol";
import { ISeerRouter } from "../src/interfaces/ISeer.sol";

/// Deploys OddsFlowRouter and OddsFlowTaker on Gnosis and writes their addresses
/// to deployments/<chainid>.json.
///
/// The router is Ownable only for SwapVM's `rescueFunds`, which can move tokens
/// stuck in the router itself — never a maker's, which stay in their wallets
/// until Aqua pulls them. Ownership is renounced in the same run, so nobody
/// holds any power over the router after deployment.
contract Deploy is Script {
    address constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address constant WXDAI = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    address constant SDAI = 0xaf204776c7245bF4147c2612BF6e5972Ee483701;
    address constant SEER_ROUTER = 0xeC9048b59b3467415b1a38F63416407eA0c70fB8;

    function run() external returns (OddsFlowRouter router, OddsFlowTaker taker) {
        vm.startBroadcast();
        router = new OddsFlowRouter(AQUA, WXDAI, msg.sender, "OddsFlow SwapVM", "1.0.2");
        router.renounceOwnership();
        taker = new OddsFlowTaker(IAqua(AQUA), ISwapVM(address(router)), IERC20(SDAI), ISeerRouter(SEER_ROUTER));
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
