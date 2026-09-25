#!/bin/sh
# Local Gnosis fork for developing the web: OddsFlow deployed at fixed addresses,
# a real Seer market, test accounts funded with sDAI and sample orders
# published. Then run `pnpm dev:fork` in another terminal.
#
#   scripts/dev-fork.sh   (reads GNOSIS_RPC_URL from the root .env)
set -eu

RPC=http://127.0.0.1:8545
# A project-specific dev key, keccak256("oddsflow-dev-fork"): public by
# construction, fork only, never funded on a real chain. Anvil's default
# account 0 cannot be used: its nonce-0 address already holds a contract on
# Gnosis, so the fixed OddsFlow addresses would collide.
DEPLOYER=0xD6acCD8255D8235888aA2245bEe71734A766B826
DEPLOYER_KEY=$(cast keccak "oddsflow-dev-fork")
SDAI=0xaf204776c7245bF4147c2612BF6e5972Ee483701
WHALE=0xBA12222222228d8Ba445958a75a0704d566BF2C8 # Balancer Vault, holds >30k sDAI on Gnosis
ACCOUNTS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC 0x90F79bf6EB2c4f870365E785982E1f101E93b906"

cd "$(dirname "$0")/../packages/contracts"
# GNOSIS_RPC_URL from the environment, or from the root .env
[ -z "${GNOSIS_RPC_URL:-}" ] && [ -f ../../.env ] && . ../../.env

anvil --fork-url "${GNOSIS_RPC_URL:?set GNOSIS_RPC_URL}" --chain-id 31337 --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
until cast block-number --rpc-url $RPC >/dev/null 2>&1; do sleep 1; done
FROM_BLOCK=$(cast block-number --rpc-url $RPC)

# Keep the deployer's nonce at 0 so OddsFlow lands at the same addresses every run.
cast rpc anvil_setNonce $DEPLOYER 0x0 --rpc-url $RPC >/dev/null
cast rpc anvil_setBalance $DEPLOYER 0xDE0B6B3A7640000 --rpc-url $RPC >/dev/null
forge script script/Deploy.s.sol --rpc-url $RPC --private-key $DEPLOYER_KEY --broadcast >/dev/null
ROUTER=$(jq -r .router deployments/31337.json)
# A real Seer market on Gnosis, open until 31 Dec 2026: no need to create one.
MARKET=0xA202b53641147D9A57AF98CB87723D97FF3162D6 # Bitcoin above 100,000 USD on 31-12-2026?

cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC >/dev/null
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url $RPC >/dev/null
for a in $ACCOUNTS; do
	cast send $SDAI "transfer(address,uint256)" "$a" 5000ether --from $WHALE --unlocked --rpc-url $RPC >/dev/null
done

DEADLINE=$(cast call 0xE78996A233895bE74a66F451f1019cA9734205cc "getOpeningTS(bytes32)(uint32)" \
	"$(cast call "$MARKET" "questionsIds()(bytes32[])" --rpc-url $RPC | tr -d '[] ')" --rpc-url $RPC | awk '{print $1}')
forge script script/SeedFork.s.sol --sig "run(address,address,uint256)" "$ROUTER" "$MARKET" "$DEADLINE" \
	--rpc-url $RPC --broadcast >/dev/null

cat > ../../.env.local <<ENV
NEXT_PUBLIC_FORK=1
NEXT_PUBLIC_FORK_FROM_BLOCK=$FROM_BLOCK
NEXT_PUBLIC_FORK_MARKET=$MARKET
ENV

echo "Gnosis fork ready at $RPC (chain 31337)"
echo "  router  $ROUTER"
echo "  market  $MARKET"
echo "  funded  $ACCOUNTS (5,000 sDAI each)"
echo "  orders  YES 0.20 (1,000) and YES 0.25 (100) by account 1, NO 0.60 (500) by account 2"
wait $ANVIL
