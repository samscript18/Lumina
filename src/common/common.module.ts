import { Module } from '@nestjs/common';
import { DistributedRateLimitGuard } from './guards/distributed-rate-limit.guard';
import { CacheModule } from '../cache/cache.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [CacheModule, AccessModule],
  providers: [DistributedRateLimitGuard],
  exports: [AccessModule, DistributedRateLimitGuard],
})
export class CommonModule {}
