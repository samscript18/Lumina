import { ImmutabilityGuardService } from './immutability-guard.service';

describe('ImmutabilityGuardService', () => {
  const service = new ImmutabilityGuardService();

  it.each([
    'Swap {amount} ETH at {{slippage}}',
    'Open <Link href="https://example.com/${wallet}">{{wallet}}</Link> now',
    '混合文本 BTC 与 {amount}',
  ])('round-trips protected content: %s', (source) => {
    const shielded = service.shieldText(source);
    expect(shielded.sanitized).not.toContain('{amount}');
    expect(service.unshieldText(shielded.sanitized, shielded.tokenMap)).toBe(source);
  });

  it('fails loudly when a token is missing', () => {
    const { tokenMap } = service.shieldText('Swap {amount} ETH');
    expect(() => service.unshieldText('Trocar', tokenMap)).toThrow(/dropped/);
  });
});
