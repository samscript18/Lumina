import { Module } from '@nestjs/common';
import { ContextParserService } from './context-parser.service';

@Module({
  providers: [ContextParserService],
  exports: [ContextParserService],
})
export class ParserModule {}
