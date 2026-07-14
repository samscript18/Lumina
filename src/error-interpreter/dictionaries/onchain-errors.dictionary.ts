export interface OnchainErrorEntry {
  code: string;
  api: 'swap' | 'transaction' | 'rfq';
  httpStatus: number;
  /** OKX's own short message, kept verbatim for traceability back to the docs */
  officialMessage: string;
  plainEnglish: string;
  actionable: string;
}

/**
 * Sourced from OKX OnchainOS official docs:
 *  - Swap API:        https://web3.okx.com/onchainos/dev-docs/trade/dex-error-code
 *  - Transaction API:  https://web3.okx.com/onchainos/dev-docs/trade/onchain-gateway-error-code
 *
 * `officialMessage` is copied from OKX's own table so the raw envelope
 * {code, msg, data} that OnchainOS actually returns can be cross-checked.
 * `plainEnglish` / `actionable` are Lumina's user-facing rewrite — this is
 * the base English dictionary; localization into other languages happens at
 * request time via the Semantic Engine (same glossary + shielding pipeline
 * as file translation), not hardcoded per-language copies here.
 */
export const ONCHAIN_ERROR_DICTIONARY: Record<string, OnchainErrorEntry> = {
  INSUFFICIENT_OUTPUT_AMOUNT: {
    code: 'INSUFFICIENT_OUTPUT_AMOUNT', api: 'swap', httpStatus: 400,
    officialMessage: 'INSUFFICIENT_OUTPUT_AMOUNT',
    plainEnglish: 'The swap would return fewer tokens than the minimum amount you approved.',
    actionable: 'Refresh the quote, reduce the trade size, or carefully increase slippage tolerance before trying again.',
  },
  TRANSFER_FROM_FAILED: {
    code: 'TRANSFER_FROM_FAILED', api: 'transaction', httpStatus: 400,
    officialMessage: 'TRANSFER_FROM_FAILED',
    plainEnglish: 'The token contract could not transfer tokens from your wallet.',
    actionable: 'Check your token balance and allowance, approve the correct spender if needed, then retry.',
  },
  INSUFFICIENT_FUNDS: {
    code: 'INSUFFICIENT_FUNDS', api: 'transaction', httpStatus: 400,
    officialMessage: 'insufficient funds for gas * price + value',
    plainEnglish: 'The wallet does not have enough native network token to pay the transaction value and gas fee.',
    actionable: 'Add enough native token for gas, reduce the amount, and try again.',
  },
  // ---- Swap API ----
  '50011': {
    code: '50011',
    api: 'swap',
    httpStatus: 429,
    officialMessage: 'Rate limit reached. Please refer to API documentation and throttle requests accordingly',
    plainEnglish: 'Too many requests were sent in a short period of time.',
    actionable: 'Wait a moment and try again. If this keeps happening, slow down how often your app requests quotes.',
  },
  '50014': {
    code: '50014',
    api: 'swap',
    httpStatus: 400,
    officialMessage: 'Parameter param0 cannot be empty',
    plainEnglish: 'The swap request was missing a required piece of information.',
    actionable: 'Check that the amount, token addresses, and chain are all filled in before submitting.',
  },
  '50026': {
    code: '50026',
    api: 'swap',
    httpStatus: 500,
    officialMessage: 'System error. Try again later',
    plainEnglish: 'Something went wrong on the exchange side, unrelated to your wallet or funds.',
    actionable: 'Wait a minute and try the swap again.',
  },
  '82000': {
    code: '82000',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'Insufficient liquidity',
    plainEnglish: 'There is not enough liquidity available to complete your trade at this size.',
    actionable: 'Try a smaller trade size, or a different token pair/route with deeper liquidity.',
  },
  '82003': {
    code: '82003',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'toTokenReferrerWalletAddress address is not valid',
    plainEnglish: 'The referrer wallet address provided for this swap is not a valid address.',
    actionable: 'Double-check the referrer address format and try again.',
  },
  '82102': {
    code: '82102',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'Less than the minimum quantity limit, the minimum amount is 0',
    plainEnglish: 'The amount you entered is below the minimum allowed for this swap.',
    actionable: 'Increase the amount and try again.',
  },
  '82103': {
    code: '82103',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'Exceeds than the maximum quantity limit, the maximum amount is 0',
    plainEnglish: 'The amount you entered is above the maximum allowed for this swap.',
    actionable: 'Reduce the amount, or split it into multiple smaller swaps.',
  },
  '82104': {
    code: '82104',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'This token is not supported',
    plainEnglish: 'This token is not currently supported for swapping.',
    actionable: 'Try a different token, or check the supported token list for this chain.',
  },
  '82105': {
    code: '82105',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'This chain is not supported',
    plainEnglish: 'This blockchain network is not currently supported for swapping.',
    actionable: 'Switch to a supported network and try again.',
  },
  '82112': {
    code: '82112',
    api: 'swap',
    httpStatus: 200,
    officialMessage:
      'The value difference from this transaction\u2019s quote route is higher than the allowed threshold, which may cause asset loss',
    plainEnglish: 'The price moved enough since your quote that completing this swap could cost you more than expected.',
    actionable: 'Refresh the quote and try again, or adjust your price-impact tolerance if you understand the risk.',
  },
  '82116': {
    code: '82116',
    api: 'swap',
    httpStatus: 200,
    officialMessage: 'callData exceeds the maximum limit. Try again in 5 minutes.',
    plainEnglish: 'This transaction is too complex to process right now.',
    actionable: 'Wait about 5 minutes and try again, or simplify the route if possible.',
  },

  // ---- Transaction API ----
  '81001': {
    code: '81001',
    api: 'transaction',
    httpStatus: 200,
    officialMessage: 'Incorrect parameter',
    plainEnglish: 'One of the values sent with this transaction was invalid.',
    actionable: 'Double-check the transaction details (addresses, amounts, chain) and resubmit.',
  },
  '81104': {
    code: '81104',
    api: 'transaction',
    httpStatus: 200,
    officialMessage: 'Chain not support',
    plainEnglish: 'This blockchain network is not currently supported.',
    actionable: 'Switch to a supported network and try again.',
  },
  '81108': {
    code: '81108',
    api: 'transaction',
    httpStatus: 200,
    officialMessage: 'Wallet type does not match the required type',
    plainEnglish: "This action requires a different type of wallet than the one you're using.",
    actionable: 'Switch to the required wallet type and try again.',
  },
  '81152': {
    code: '81152',
    api: 'transaction',
    httpStatus: 200,
    officialMessage: 'Coin not exist',
    plainEnglish: "The token you're trying to use couldn't be found.",
    actionable: 'Double check the token symbol or contract address, then try again.',
  },
  '81451': {
    code: '81451',
    api: 'transaction',
    httpStatus: 200,
    officialMessage: 'node return failed',
    plainEnglish: 'The blockchain node rejected or failed to process this transaction.',
    actionable: 'Wait a moment and resubmit. If it keeps failing, the network may be congested.',
  },
};

export function lookupOnchainError(code: string): OnchainErrorEntry | undefined {
  const normalized = code.trim();
  if (ONCHAIN_ERROR_DICTIONARY[normalized]) return ONCHAIN_ERROR_DICTIONARY[normalized];
  const upper = normalized.toUpperCase();
  return Object.entries(ONCHAIN_ERROR_DICTIONARY).find(([key]) => upper.includes(key))?.[1];
}
