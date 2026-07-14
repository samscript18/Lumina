import { SemanticEngineService } from './semantic-engine.service';

describe('SemanticEngineService token contract', () => {
  it('enumerates the exact allowed tokens in corrective prompts', async () => {
    const llm = { chatCompletion: jest.fn(async () => 'translated') };
    const glossary = { findRelevantTerms: jest.fn(async () => []) };
    const service = new SemanticEngineService(llm as never, glossary as never);

    await service.translateWithCorrection(
      'Swap __LUMINA_SHIELD_0__ __LUMINA_SHIELD_1__ from __LUMINA_SHIELD_2__',
      'pt-BR',
    );

    const messages = (llm.chatCompletion.mock.calls as unknown as [[{ content: string }[]]])[0][0];
    const combined = messages.map((message: { content: string }) => message.content).join('\n');
    expect(combined).toContain('__LUMINA_SHIELD_0__, __LUMINA_SHIELD_1__, __LUMINA_SHIELD_2__');
    expect(combined).toContain('must not contain any other __LUMINA_SHIELD_ token');
    expect(combined).not.toContain('__LUMINA_SHIELD_N__');
  });

  it('explicitly forbids shield tokens when the input has none', async () => {
    const llm = { chatCompletion: jest.fn(async () => 'Réessayer') };
    const glossary = { findRelevantTerms: jest.fn(async () => []) };
    const service = new SemanticEngineService(llm as never, glossary as never);

    await service.translate({ sanitizedText: 'Try again', targetLanguage: 'fr' });

    const messages = (llm.chatCompletion.mock.calls as unknown as [[{ content: string }[]]])[0][0];
    expect(messages[0]!.content).toContain('contains no protected tokens');
  });
});
