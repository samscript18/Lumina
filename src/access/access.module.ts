import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { DatabaseModule } from '../database/database.module';
import { AdminApiKeysController } from './admin-api-keys.controller';
import { ApiCredentialService } from './api-credential.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminApiKeysController],
  providers: [ApiCredentialService, ApiKeyGuard],
  exports: [ApiCredentialService, ApiKeyGuard],
})
export class AccessModule {}
