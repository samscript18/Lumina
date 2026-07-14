import { TranslationValidatorService } from './translation-validator.service';

describe('TranslationValidatorService', () => {
  const service = new TranslationValidatorService();

  it('accepts each expected token exactly once', () => {
    expect(service.validateShieldedTranslation('Use __LUMINA_SHIELD_0__', ['__LUMINA_SHIELD_0__']).valid).toBe(true);
  });

  it('rejects missing, duplicated, invented and empty output', () => {
    expect(service.validateShieldedTranslation('', ['__LUMINA_SHIELD_0__']).valid).toBe(false);
    expect(service.validateShieldedTranslation('__LUMINA_SHIELD_0__ __LUMINA_SHIELD_0__ __LUMINA_SHIELD_2__', ['__LUMINA_SHIELD_0__']).valid).toBe(false);
  });

  it('rejects empty reconstructed leaves', () => {
    expect(service.validateJsonPayload({ nested: { title: ' ' } }).valid).toBe(false);
  });
});
