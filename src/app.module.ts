import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration, { validateEnvironment } from './config/configuration';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { ParserModule } from './parser/parser.module';
import { ShieldModule } from './shield/shield.module';
import { SemanticModule } from './semantic/semantic.module';
import { ValidatorModule } from './validator/validator.module';
import { CacheModule } from './cache/cache.module';
import { TranslationModule } from './translation/translation.module';
import { GitopsModule } from './gitops/gitops.module';
import { ErrorInterpreterModule } from './error-interpreter/error-interpreter.module';
import { GlossaryModule } from './glossary/glossary.module';
import { McpModule } from './mcp/mcp.module';
import { MetricsModule } from './metrics/metrics.module';
import { DistributedRateLimitGuard } from './common/guards/distributed-rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnvironment }),
    MetricsModule,
    DatabaseModule,
    ParserModule,
    ShieldModule,
    SemanticModule,
    ValidatorModule,
    CacheModule,
    TranslationModule,
    GitopsModule,
    ErrorInterpreterModule,
    GlossaryModule,
    McpModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: DistributedRateLimitGuard }],
})
export class AppModule {}
