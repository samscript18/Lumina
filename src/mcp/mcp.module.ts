import { Module } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { TranslationModule } from '../translation/translation.module';
import { ErrorInterpreterModule } from '../error-interpreter/error-interpreter.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TranslationModule, ErrorInterpreterModule, DatabaseModule],
  providers: [McpServerService],
  exports: [McpServerService],
})
export class McpModule {}
