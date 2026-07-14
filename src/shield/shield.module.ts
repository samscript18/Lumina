import { Module } from '@nestjs/common';
import { ImmutabilityGuardService } from './immutability-guard.service';

@Module({
  providers: [ImmutabilityGuardService],
  exports: [ImmutabilityGuardService],
})
export class ShieldModule {}
