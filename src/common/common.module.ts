import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { DistributedRateLimitGuard } from './guards/distributed-rate-limit.guard';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [ApiKeyGuard, DistributedRateLimitGuard],
  exports: [ApiKeyGuard, DistributedRateLimitGuard],
})
export class CommonModule {}
