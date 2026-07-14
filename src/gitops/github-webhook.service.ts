import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../cache/redis.service';
import { ContextParserService } from '../parser/context-parser.service';
import { SourceFormat } from '../parser/interfaces/parsed-string.interface';
import { GitopsService } from './gitops.service';
import { GitHubClientService } from './github-client.service';
import { MetricsService } from '../metrics/metrics.service';

export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  deleted?: boolean;
  repository: { full_name: string; default_branch: string };
}

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly github: GitHubClientService,
    private readonly gitops: GitopsService,
    private readonly parser: ContextParserService,
    private readonly metrics: MetricsService,
  ) {}

  async processPush(payload: GitHubPushPayload, deliveryId: string) {
    this.metrics.increment('github_webhooks_total');
    if (!payload.repository?.full_name || !payload.before || !payload.after || !payload.ref) {
      throw new BadRequestException('Malformed GitHub push payload');
    }
    if (payload.deleted) return { status: 'ignored', reason: 'deleted branch' };
    if (!(await this.redis.claimIdempotencyKey(`github:${deliveryId}`))) return { status: 'duplicate' };

    try {
      const repository = payload.repository.full_name;
      const baseBranch = payload.ref.replace('refs/heads/', '');
      const files = await this.github.compare(repository, payload.before, payload.after);
      const candidates = files.filter((file) => file.status !== 'removed' && this.detectFormat(file.filename));
      if (candidates.length === 0) return { status: 'ignored', reason: 'no supported source locale files' };

      const targetLanguages = this.config.get<string[]>('github.targetLanguages') ?? [];
      const syncFiles = [];
      for (const file of candidates) {
        const current = await this.github.getTextFile(repository, file.filename, payload.after);
        if (!current) continue;
        const previousPath = file.previous_filename ?? file.filename;
        const previous = /^0+$/.test(payload.before) ? null : await this.github.getTextFile(repository, previousPath, payload.before);
        const previousTranslatedContent: Record<string, string> = {};
        for (const language of targetLanguages) {
          const outputPath = this.outputPath(file.filename, language);
          const localized = await this.github.getTextFile(repository, outputPath, payload.before);
          if (localized) previousTranslatedContent[language] = localized.content;
        }
        syncFiles.push({
          path: file.filename,
          content: current.content,
          previousContent: previous?.content,
          previousTranslatedContent,
          format: this.detectFormat(file.filename)!,
        });
      }
      if (syncFiles.length === 0) return { status: 'ignored', reason: 'source files unavailable' };

      const results = await this.gitops.syncRepository({ repository, targetLanguages, files: syncFiles });
      if (results.length === 0) return { status: 'unchanged' };
      const branch = `lumina/i18n-${deliveryId.slice(0, 12).replace(/[^a-zA-Z0-9-]/g, '')}`;
      await this.github.createBranch(repository, branch, payload.after);
      for (const result of results) {
        const outputPath = this.outputPath(result.path, result.targetLanguage);
        const existing = await this.github.getTextFile(repository, outputPath, payload.after);
        const parsed = this.parser.parse(syncFiles.find((file) => file.path === result.path)!.content, syncFiles.find((file) => file.path === result.path)!.format);
        const content = this.parser.serialize(parsed, result.translated);
        await this.github.putTextFile(repository, branch, outputPath, content, existing?.sha);
      }
      const pullRequestUrl = await this.github.createPullRequest(
        repository, branch, baseBranch, 'chore(i18n): update localized assets',
        `Automated by Lumina from push \`${payload.after.slice(0, 12)}\`.\n\nValidated Web3-aware translations: ${results.length} artifact(s).`,
      );
      this.metrics.increment('github_pull_requests_total');
      this.logger.log(`Created localization PR ${pullRequestUrl}`);
      return { status: 'created', pullRequestUrl, artifacts: results.length };
    } catch (error) {
      await this.redis.releaseIdempotencyKey(`github:${deliveryId}`);
      throw error;
    }
  }

  private detectFormat(path: string): SourceFormat | null {
    const sourceLocale = this.config.get<string>('github.sourceLocale') ?? 'en';
    const escaped = sourceLocale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isSource = new RegExp(`(?:^|/)(?:${escaped})(?:/|\\.(?:json|[jt]s)$)`, 'i').test(path);
    if (!isSource) return null;
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.ts')) return 'ts-i18n';
    if (path.endsWith('.js')) return 'js-i18n';
    return null;
  }

  private outputPath(sourcePath: string, language: string): string {
    const sourceLocale = this.config.get<string>('github.sourceLocale') ?? 'en';
    const directoryPattern = new RegExp(`(^|/)${sourceLocale}(?=/)`);
    if (directoryPattern.test(sourcePath)) return sourcePath.replace(directoryPattern, `$1${language}`);
    const filenamePattern = new RegExp(`(^|/)${sourceLocale}(?=\\.(?:json|[jt]s)$)`);
    if (filenamePattern.test(sourcePath)) return sourcePath.replace(filenamePattern, `$1${language}`);
    const directory = this.config.get<string>('github.outputDirectory') ?? 'locales';
    const extension = sourcePath.split('.').pop() ?? 'json';
    return `${directory}/${language}.${extension}`;
  }
}
