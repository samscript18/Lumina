import { Module } from '@nestjs/common';
import { GitopsController } from './gitops.controller';
import { GitopsService } from './gitops.service';
import { TranslationModule } from '../translation/translation.module';
import { CommonModule } from '../common/common.module';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [TranslationModule, CommonModule, ParserModule],
  controllers: [GitopsController],
  providers: [GitopsService],
})
export class GitopsModule {}
