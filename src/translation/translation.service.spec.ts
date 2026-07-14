import { UnprocessableEntityException } from '@nestjs/common';
import { ContextParserService } from '../parser/context-parser.service';
import { ImmutabilityGuardService } from '../shield/immutability-guard.service';
import { TranslationValidatorService } from '../validator/translation-validator.service';
import { TranslationService } from './translation.service';

function createService(outputs: string[]) {
  const semantic = {
    translate: jest.fn(async () => outputs.shift()!),
    translateWithCorrection: jest.fn(async () => outputs.shift()!),
  };
  const redis = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
  const cache = { findByHash: jest.fn(async () => null), upsert: jest.fn(async () => ({})), registerHit: jest.fn() };
  const metrics = { increment: jest.fn() };
  const service = new TranslationService(
    new ContextParserService(), new ImmutabilityGuardService(), semantic as never,
    new TranslationValidatorService(), redis as never, cache as never, metrics as never,
  );
  return { service, semantic, redis, cache, metrics };
}

describe('TranslationService', () => {
  it('retries once and persists only valid output', async () => {
    const { service, semantic, cache } = createService(['Montante ausente', 'Trocar __LUMINA_SHIELD_0__']);
    await expect(service.translateString('Swap {amount}', 'pt-BR')).resolves.toBe('Trocar {amount}');
    expect(semantic.translateWithCorrection).toHaveBeenCalledTimes(1);
    expect(cache.upsert).toHaveBeenCalledTimes(1);
  });

  it('fails after one invalid corrective response and does not persist', async () => {
    const { service, cache } = createService(['bad', 'still bad']);
    await expect(service.translateString('Swap {amount}', 'fr')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(cache.upsert).not.toHaveBeenCalled();
  });
});
