import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TranslationCache, TranslationCacheDocument } from './schemas/translation-cache.schema';
import { Web3Glossary, Web3GlossaryDocument } from './schemas/web3-glossary.schema';

@Injectable()
export class DatabaseIndexVerifierService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseIndexVerifierService.name);

  constructor(
    @InjectModel(TranslationCache.name) private readonly cache: Model<TranslationCacheDocument>,
    @InjectModel(Web3Glossary.name) private readonly glossary: Model<Web3GlossaryDocument>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([this.cache.createIndexes(), this.glossary.createIndexes()]);
    const [cacheIndexes, glossaryIndexes] = await Promise.all([
      this.cache.collection.indexes(),
      this.glossary.collection.indexes(),
    ]);
    this.assertUnique(cacheIndexes, 'stringHash_1', 'translation_cache.stringHash');
    this.assertUnique(glossaryIndexes, 'term_1', 'web3_glossary.term');
    this.logger.log('MongoDB indexes created and verified');
  }

  private assertUnique(indexes: { name?: string; unique?: boolean }[], name: string, label: string): void {
    const index = indexes.find((candidate) => candidate.name === name);
    if (!index?.unique) throw new Error(`Required unique index is missing: ${label}`);
  }
}
