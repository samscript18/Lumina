import { Module } from '@nestjs/common';
import { GitopsController } from './gitops.controller';
import { GitopsService } from './gitops.service';
import { TranslationModule } from '../translation/translation.module';
import { CommonModule } from '../common/common.module';
import { ParserModule } from '../parser/parser.module';
import { CacheModule } from '../cache/cache.module';
import { GitHubClientService } from './github-client.service';
import { GitHubWebhookService } from './github-webhook.service';

@Module({
  imports: [TranslationModule, CommonModule, ParserModule, CacheModule],
  controllers: [GitopsController],
  providers: [GitopsService, GitHubClientService, GitHubWebhookService],
})
export class GitopsModule {}
