import { Injectable, Logger } from '@nestjs/common';
import { TranslationService } from '../translation/translation.service';
import { ContextParserService } from '../parser/context-parser.service';
import { SourceFormat } from '../parser/interfaces/parsed-string.interface';

export interface GitSyncFile {
  path: string;
  content: string;
  format: SourceFormat;
  /** Previous committed content, if known — enables string-level diffing */
  previousContent?: string;
  /** Previously generated target-language files, keyed by language code. */
  previousTranslatedContent?: Record<string, string>;
}

export interface GitSyncRequest {
  repository: string;
  targetLanguages: string[];
  files: GitSyncFile[];
}

export interface GitSyncFileResult {
  path: string;
  targetLanguage: string;
  changedStringCount: number;
  translated: unknown;
}

@Injectable()
export class GitopsService {
  private readonly logger = new Logger(GitopsService.name);

  constructor(
    private readonly translationService: TranslationService,
    private readonly parser: ContextParserService,
  ) {}

  async syncRepository(req: GitSyncRequest): Promise<GitSyncFileResult[]> {
    const results: GitSyncFileResult[] = [];

    for (const file of req.files) {
      const changedPaths = this.changedStringPaths(file);
      const changedCount = changedPaths === null ? -1 : changedPaths.size;
      this.logger.log(`GitOps: ${file.path} — ${changedCount} changed string(s) detected`);

      if (changedCount === 0) {
        this.logger.log(`GitOps: ${file.path} unchanged, skipping translation pipeline entirely`);
        continue;
      }

      for (const targetLanguage of req.targetLanguages) {
        const translated = await this.translateIncrementally(file, targetLanguage, changedPaths);

        results.push({
          path: file.path,
          targetLanguage,
          changedStringCount: changedCount,
          translated,
        });
      }
    }

    return results;
  }

  /**
   * String-level delta detection: parses both the previous and current
   * content with the same Context Parser used by the translation pipeline,
   * then diffs extracted string *values* (not raw lines). This correctly
   * ignores formatting-only changes (reordered keys, whitespace) and
   * correctly flags a change even when it happens mid-line in a minified
   * or single-line file.
   */
  private changedStringPaths(file: GitSyncFile): Set<string> | null {
    if (!file.previousContent) return null;
    if (file.previousContent === file.content) return new Set();

    try {
      const previous = this.parser.parse(file.previousContent, file.format);
      const current = this.parser.parse(file.content, file.format);

      const previousByPath = new Map(previous.strings.map((s) => [this.pathKey(s.keyPath), s.value]));
      return new Set(
        current.strings
          .filter((entry) => previousByPath.get(this.pathKey(entry.keyPath)) !== entry.value)
          .map((entry) => this.pathKey(entry.keyPath)),
      );
    } catch (err) {
      this.logger.warn(
        `String-level diff failed for ${file.path}, falling back to whole-file reprocessing: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async translateIncrementally(
    file: GitSyncFile,
    targetLanguage: string,
    changedPaths: Set<string> | null,
  ): Promise<unknown> {
    const current = this.parser.parse(file.content, file.format);
    const previousTranslatedRaw = file.previousTranslatedContent?.[targetLanguage];

    // A complete previous localized artifact is necessary to safely reuse
    // unchanged values. Without it, produce a complete translation once.
    if (!changedPaths || !previousTranslatedRaw) {
      return (await this.translationService.translateFile({
        content: file.content,
        format: file.format,
        targetLanguage,
      })).translated;
    }

    const previousTranslated = this.parser.parse(previousTranslatedRaw, file.format);
    const localizedByPath = new Map(
      previousTranslated.strings.map((entry) => [this.pathKey(entry.keyPath), entry.value]),
    );
    const output = [];
    for (const entry of current.strings) {
      const key = this.pathKey(entry.keyPath);
      const value = changedPaths.has(key) || !localizedByPath.has(key)
        ? await this.translationService.translateString(entry.value, targetLanguage)
        : localizedByPath.get(key)!;
      output.push({ keyPath: entry.keyPath, value });
    }
    return this.parser.reconstruct(current.skeleton, output);
  }

  private pathKey(path: (string | number)[]): string {
    return JSON.stringify(path);
  }
}
