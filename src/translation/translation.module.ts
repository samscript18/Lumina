import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { ParserModule } from '../parser/parser.module';
import { ShieldModule } from '../shield/shield.module';
import { SemanticModule } from '../semantic/semantic.module';
import { ValidatorModule } from '../validator/validator.module';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ParserModule, ShieldModule, SemanticModule, ValidatorModule, CacheModule, DatabaseModule, CommonModule],
  providers: [TranslationService],
  controllers: [TranslationController],
  exports: [TranslationService],
})
export class TranslationModule {}
