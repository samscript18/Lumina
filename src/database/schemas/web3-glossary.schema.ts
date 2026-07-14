import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type Web3GlossaryDocument = Web3Glossary & Document;

export type DomainContext = 'DEX' | 'NFT' | 'DAO' | 'LENDING' | 'BRIDGE' | 'WALLET' | 'GENERAL';

@Schema({ timestamps: true, collection: 'web3_glossary' })
export class Web3Glossary {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  term!: string;

  @Prop({ required: true, default: 'GENERAL' })
  domainContext!: DomainContext;

  // Map of language code -> verified localized term, e.g. { "pt-BR": "carteira", "zh-CN": "钱包" }
  @Prop({ type: MongooseSchema.Types.Map, of: String, default: {} })
  localizedMappings!: Map<string, string>;
}

export const Web3GlossarySchema = SchemaFactory.createForClass(Web3Glossary);
