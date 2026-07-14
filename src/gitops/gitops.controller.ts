import { BadRequestException, Body, Controller, Headers, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { GitopsService, GitSyncRequest } from './gitops.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GitHubPushPayload, GitHubWebhookService } from './github-webhook.service';

class GitSyncFileDto {
  @IsString() @MinLength(1) @MaxLength(1024) path!: string;
  @IsString() @MinLength(1) content!: string;
  @IsIn(['json', 'ts-i18n', 'js-i18n']) format!: 'json' | 'ts-i18n' | 'js-i18n';
  @IsOptional() @IsString() previousContent?: string;
  @IsOptional() @IsObject() previousTranslatedContent?: Record<string, string>;
}

class GitSyncDto implements GitSyncRequest {
  @IsString() @MinLength(1) @MaxLength(512) repository!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsString({ each: true }) targetLanguages!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => GitSyncFileDto) files!: GitSyncFileDto[];
}

@ApiTags('GitOps')
@Controller('webhooks')
export class GitopsController {
  constructor(
    private readonly gitopsService: GitopsService,
    private readonly config: ConfigService,
    private readonly githubWebhook: GitHubWebhookService,
  ) {}

  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Translate an explicitly supplied localization file tree' })
  @Post('git-sync')
  async gitSync(
    @Body() body: GitSyncDto,
    @Headers('x-hub-signature-256') githubSignature: string | undefined,
    @Headers('x-lumina-signature') luminaSignature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    this.verifySignature(request.rawBody ?? Buffer.from(JSON.stringify(body)), githubSignature ?? luminaSignature);

    if (!body?.files?.length) {
      throw new BadRequestException('No files provided in git-sync payload');
    }
    if (!body?.targetLanguages?.length) {
      throw new BadRequestException('No targetLanguages provided in git-sync payload');
    }

    const results = await this.gitopsService.syncRepository(body);
    return { repository: body.repository, fileCount: body.files.length, results };
  }

  @ApiOperation({ summary: 'Receive a native signed GitHub push webhook and open a localization PR' })
  @Post('github')
  async githubPush(
    @Body() body: GitHubPushPayload,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    this.verifySignature(request.rawBody ?? Buffer.from(JSON.stringify(body)), signature, true);
    if (event === 'ping') return { status: 'ok' };
    if (event !== 'push') throw new BadRequestException(`Unsupported GitHub event: ${event ?? 'missing'}`);
    if (!deliveryId) throw new BadRequestException('Missing X-GitHub-Delivery header');
    return this.githubWebhook.processPush(body, deliveryId);
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined, required = false): void {
    const secret = this.config.get<string>('gitWebhookSecret');
    if (!secret) {
      if (required || this.config.get<string>('nodeEnv') === 'production') {
        throw new UnauthorizedException('GIT_WEBHOOK_SECRET must be configured');
      }
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing X-Lumina-Signature header');
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const normalized = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const provided = Buffer.from(normalized);
    const expectedBuf = Buffer.from(expected);

    if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
