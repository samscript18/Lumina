import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TranslationCache, TranslationCacheSchema } from './schemas/translation-cache.schema';
import { Web3Glossary, Web3GlossarySchema } from './schemas/web3-glossary.schema';
import { TranslationCacheRepository } from './repositories/translation-cache.repository';
import { Web3GlossaryRepository } from './repositories/web3-glossary.repository';
import { DatabaseIndexVerifierService } from './database-index-verifier.service';
import { ApiCredential, ApiCredentialSchema } from '../access/api-credential.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongodbUri'),
      }),
    }),
    MongooseModule.forFeature([
      { name: TranslationCache.name, schema: TranslationCacheSchema },
      { name: Web3Glossary.name, schema: Web3GlossarySchema },
      { name: ApiCredential.name, schema: ApiCredentialSchema },
    ]),
  ],
  providers: [TranslationCacheRepository, Web3GlossaryRepository, DatabaseIndexVerifierService],
  exports: [TranslationCacheRepository, Web3GlossaryRepository, MongooseModule],
})
export class DatabaseModule {}
