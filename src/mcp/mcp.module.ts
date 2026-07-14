import { Module } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { TranslationModule } from '../translation/translation.module';
import { ErrorInterpreterModule } from '../error-interpreter/error-interpreter.module';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { McpController } from './mcp.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TranslationModule, ErrorInterpreterModule, DatabaseModule, CacheModule, CommonModule],
  controllers: [McpController],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpModule {}
