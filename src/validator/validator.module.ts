import { Module } from '@nestjs/common';
import { TranslationValidatorService } from './translation-validator.service';

@Module({
  providers: [TranslationValidatorService],
  exports: [TranslationValidatorService],
})
export class ValidatorModule {}
