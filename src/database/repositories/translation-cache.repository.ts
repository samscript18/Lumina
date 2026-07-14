import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TranslationCache, TranslationCacheDocument } from '../schemas/translation-cache.schema';

@Injectable()
export class TranslationCacheRepository {
  constructor(
    @InjectModel(TranslationCache.name)
    private readonly model: Model<TranslationCacheDocument>,
  ) {}

  async findByHash(stringHash: string): Promise<TranslationCacheDocument | null> {
    return this.model.findOne({ stringHash }).exec();
  }

  async upsert(entry: {
    stringHash: string;
    sourceText: string;
    targetLanguage: string;
    translatedText: string;
  }): Promise<TranslationCacheDocument> {
    return this.model
      .findOneAndUpdate(
        { stringHash: entry.stringHash },
        {
          $set: {
            sourceText: entry.sourceText,
            targetLanguage: entry.targetLanguage,
            translatedText: entry.translatedText,
            lastHit: new Date(),
          },
          $setOnInsert: { hitCount: 0 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async registerHit(stringHash: string): Promise<void> {
    await this.model
      .updateOne({ stringHash }, { $inc: { hitCount: 1 }, $set: { lastHit: new Date() } })
      .exec();
  }
}
