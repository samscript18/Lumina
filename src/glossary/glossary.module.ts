import { Module } from '@nestjs/common';
import { GlossaryController } from './glossary.controller';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [GlossaryController],
})
export class GlossaryModule {}
