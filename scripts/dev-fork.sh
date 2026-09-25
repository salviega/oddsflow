#!/bin/sh
# Local Base fork for developing the web: OddsFlow deployed at fixed addresses,
# the demo market created, test accounts funded with sUSDS and sample orders
# published. Then run `pnpm dev:fork` in another terminal.
#
#   scripts/dev-fork.sh   (reads BASE_RPC_URL from packages/contracts/.env)
set -eu

RPC=http://127.0.0.1:8545
DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
SUSDS=0x5875eEE11Cf8398102FdAd704C9E96607675467a
WHALE=0x1601843c5E9bC251A3272907010AFa41Fa18347E # holds >1M sUSDS on Base
ACCOUNTS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC 0x90F79bf6EB2c4f870365E785982E1f101E93b906"

cd "$(dirname "$0")/../packages/contracts"
# BASE_RPC_URL from the environment, or from packages/contracts/.env
[ -z "${BASE_RPC_URL:-}" ] && [ -f .env ] && . ./.env

anvil --fork-url "${BASE_RPC_URL:?set BASE_RPC_URL}" --chain-id 31337 --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
until cast block-number --rpc-url $RPC >/dev/null 2>&1; do sleep 1; done
FROM_BLOCK=$(cast block-number --rpc-url $RPC)

# Mainnet has used Anvil's default keys; reset the nonce so addresses are fixed.
cast rpc anvil_setNonce $DEPLOYER 0x0 --rpc-url $RPC >/dev/null
forge script script/Deploy.s.sol --rpc-url $RPC --private-key $DEPLOYER_KEY --broadcast >/dev/null
ROUTER=$(jq -r .router deployments/31337.json)
forge script script/CreateDemoMarket.s.sol --rpc-url $RPC --private-key $DEPLOYER_KEY --broadcast >/dev/null
# The simulated address can differ from the created one; read what is on chain.
MARKET=$(cast call 0x886Ef0A78faBbAE942F1dA1791A8ed02a5aF8BC6 "allMarkets()(address[])" --rpc-url $RPC \
	| tr -d '[] ' | tr ',' '\n' | tail -1)
cast call "$MARKET" "marketName()(string)" --rpc-url $RPC | grep -q "OddsFlow" \
	|| { echo "demo market was not created" >&2; exit 1; }

cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC >/dev/null
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url $RPC >/dev/null
for a in $ACCOUNTS; do
	cast send $SUSDS "transfer(address,uint256)" "$a" 10000ether --from $WHALE --unlocked --rpc-url $RPC >/dev/null
done

DEADLINE=$(cast call 0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8 "getOpeningTS(bytes32)(uint32)" \
	"$(cast call "$MARKET" "questionsIds()(bytes32[])" --rpc-url $RPC | tr -d '[] ')" --rpc-url $RPC | awk '{print $1}')
forge script script/SeedFork.s.sol --sig "run(address,address,uint256)" "$ROUTER" "$MARKET" "$DEADLINE" \
	--rpc-url $RPC --broadcast >/dev/null

cat > ../../apps/web/.env.local <<ENV
NEXT_PUBLIC_FORK=1
NEXT_PUBLIC_FORK_FROM_BLOCK=$FROM_BLOCK
NEXT_PUBLIC_FORK_MARKET=$MARKET
ENV

echo "Base fork ready at $RPC (chain 31337)"
echo "  router  $ROUTER"
echo "  market  $MARKET"
echo "  funded  $ACCOUNTS (10,000 sUSDS each)"
echo "  orders  YES 0.20 (1,000) and YES 0.25 (100) by account 1, NO 0.60 (500) by account 2"
wait $ANVIL
