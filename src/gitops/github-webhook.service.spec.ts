import { ContextParserService } from '../parser/context-parser.service';
import { GitHubWebhookService } from './github-webhook.service';

describe('GitHubWebhookService', () => {
  const payload = {
    ref: 'refs/heads/main', before: 'before-sha', after: 'after-sha',
    repository: { full_name: 'owner/repo', default_branch: 'main' },
  };

  it('deduplicates GitHub deliveries', async () => {
    const redis = { claimIdempotencyKey: jest.fn(async () => false) };
    const service = new GitHubWebhookService(
      { get: jest.fn() } as never, redis as never, {} as never, {} as never,
      new ContextParserService(), { increment: jest.fn() } as never,
    );
    await expect(service.processPush(payload, 'delivery-1')).resolves.toEqual({ status: 'duplicate' });
  });

  it('creates a PR with generated localized artifacts', async () => {
    const configValues: Record<string, unknown> = {
      'github.targetLanguages': ['fr'], 'github.sourceLocale': 'en', 'github.outputDirectory': 'locales',
    };
    const redis = { claimIdempotencyKey: jest.fn(async () => true), releaseIdempotencyKey: jest.fn() };
    const github = {
      compare: jest.fn(async () => [{ filename: 'locales/en.json', status: 'modified' }]),
      getTextFile: jest.fn(async (_repo: string, path: string, ref: string) => {
        if (path === 'locales/en.json') return { content: ref === 'after-sha' ? '{"title":"New"}' : '{"title":"Old"}', sha: 'source' };
        if (path === 'locales/fr.json' && ref === 'before-sha') return { content: '{"title":"Ancien"}', sha: 'old-fr' };
        return null;
      }),
      createBranch: jest.fn(), putTextFile: jest.fn(),
      createPullRequest: jest.fn(async () => 'https://github.com/owner/repo/pull/1'),
    };
    const gitops = { syncRepository: jest.fn(async () => [{ path: 'locales/en.json', targetLanguage: 'fr', changedStringCount: 1, translated: { title: 'Nouveau' } }]) };
    const metrics = { increment: jest.fn() };
    const service = new GitHubWebhookService(
      { get: (key: string) => configValues[key] } as never, redis as never, github as never,
      gitops as never, new ContextParserService(), metrics as never,
    );
    const result = await service.processPush(payload, 'delivery-123456789');
    expect(result).toEqual({ status: 'created', pullRequestUrl: 'https://github.com/owner/repo/pull/1', artifacts: 1 });
    expect(github.putTextFile).toHaveBeenCalledWith('owner/repo', expect.stringContaining('lumina/i18n-'), 'locales/fr.json', expect.stringContaining('Nouveau'), undefined);
  });
});
