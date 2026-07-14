import { ContextParserService } from '../parser/context-parser.service';
import { GitopsService } from './gitops.service';

describe('GitopsService', () => {
  it('translates only changed key paths when a prior localized artifact exists', async () => {
    const translation = {
      translateString: jest.fn(async (value: string) => `FR:${value}`),
      translateFile: jest.fn(),
    };
    const service = new GitopsService(translation as never, new ContextParserService());
    const results = await service.syncRepository({
      repository: 'owner/repo',
      targetLanguages: ['fr'],
      files: [{
        path: 'en.json', format: 'json',
        previousContent: '{"a":"Same","b":"Old"}',
        content: '{"a":"Same","b":"New"}',
        previousTranslatedContent: { fr: '{"a":"Même","b":"Ancien"}' },
      }],
    });
    expect(translation.translateString).toHaveBeenCalledTimes(1);
    expect(translation.translateString).toHaveBeenCalledWith('New', 'fr');
    expect(results[0]!.translated).toEqual({ a: 'Même', b: 'FR:New' });
    expect(results[0]!.changedStringCount).toBe(1);
  });

  it('skips a byte-identical file', async () => {
    const translation = { translateString: jest.fn(), translateFile: jest.fn() };
    const service = new GitopsService(translation as never, new ContextParserService());
    const results = await service.syncRepository({ repository: 'r', targetLanguages: ['fr'], files: [{ path: 'x.json', format: 'json', content: '{}', previousContent: '{}' }] });
    expect(results).toEqual([]);
    expect(translation.translateFile).not.toHaveBeenCalled();
  });
});
