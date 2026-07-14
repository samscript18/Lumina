import { Module } from '@nestjs/common';
import { SemanticEngineService } from './semantic-engine.service';
import { LlmClientService } from './llm-client.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SemanticEngineService, LlmClientService],
  exports: [SemanticEngineService, LlmClientService],
})
export class SemanticModule {}
