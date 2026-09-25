// Sending one or more calls as a single confirmation when the wallet supports
// EIP-5792 (wallet_sendCalls), one after another when it does not.

import { type Abi, BaseError, ContractFunctionRevertedError, type Hex, UserRejectedRequestError } from 'viem'
import { sendCalls, waitForCallsStatus } from 'wagmi/actions'
import { wagmiConfig } from './wagmi'

export type Call = { to: `0x${string}`; data: Hex }

export async function send(calls: Call[]): Promise<Hex[]> {
	const { id } = await sendCalls(wagmiConfig, { calls, experimental_fallback: true })
	const result = await waitForCallsStatus(wagmiConfig, { id })
	const receipts = result.receipts ?? []
	if (result.status !== 'success' || receipts.some((r) => r.status !== 'success')) {
		throw new Error('reverted')
	}
	return receipts.map((r) => r.transactionHash)
}

/** What went wrong and what to do, in words (spec 09 §6). */
export function explain(error: unknown, known: Record<string, string> = {}): string {
	if (error instanceof BaseError) {
		if (error.walk((e) => e instanceof UserRejectedRequestError)) {
			return 'You cancelled in your wallet. Nothing moved.'
		}
		const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
		if (revert instanceof ContractFunctionRevertedError) {
			const name = revert.data?.errorName
			if (name && known[name]) {
				return known[name]
			}
		}
		return `${error.shortMessage} Nothing moved; try again.`
	}
	if (error instanceof Error && error.message === 'reverted') {
		return 'The transaction reverted on chain. Nothing moved; review the numbers and try again.'
	}
	return 'Something went wrong before anything was sent. Nothing moved; try again.'
}

export type { Abi }
