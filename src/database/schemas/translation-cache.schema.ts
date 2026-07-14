import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TranslationCacheDocument = TranslationCache & Document;

@Schema({ timestamps: true, collection: 'translation_cache' })
export class TranslationCache {
  @Prop({ required: true, unique: true, index: true })
  stringHash!: string; // MD5 of `${sourceText}::${targetLanguage}`

  @Prop({ required: true })
  sourceText!: string;

  @Prop({ required: true, index: true })
  targetLanguage!: string;

  @Prop({ required: true })
  translatedText!: string;

  @Prop({ default: 0 })
  hitCount!: number;

  @Prop({ default: () => new Date() })
  lastHit!: Date;
}

export const TranslationCacheSchema = SchemaFactory.createForClass(TranslationCache);
