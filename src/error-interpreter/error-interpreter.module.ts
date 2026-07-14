import { Module } from '@nestjs/common';
import { ErrorInterpreterController, OnchainController } from './error-interpreter.controller';
import { ErrorInterpreterService } from './error-interpreter.service';
import { OnchainOsClientService } from './onchain-os-client.service';
import { TranslationModule } from '../translation/translation.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [TranslationModule, CommonModule],
  controllers: [ErrorInterpreterController, OnchainController],
  providers: [ErrorInterpreterService, OnchainOsClientService],
  exports: [ErrorInterpreterService],
})
export class ErrorInterpreterModule {}
