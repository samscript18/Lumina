import { lookupOnchainError } from './onchain-errors.dictionary';

describe('lookupOnchainError', () => {
  it('finds numeric OnchainOS codes', () => {
    expect(lookupOnchainError('82000')?.plainEnglish).toMatch(/liquidity/i);
  });

  it('extracts common EVM revert names from raw messages', () => {
    expect(lookupOnchainError('execution reverted: TRANSFER_FROM_FAILED')?.code).toBe('TRANSFER_FROM_FAILED');
  });
});
