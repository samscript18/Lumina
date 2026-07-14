import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { API_SCOPES, ApiCredentialService } from './api-credential.service';
import { RequireScopes } from './scopes.decorator';

class CreateApiKeyDto {
  @ApiProperty({ example: 'production-dapp' }) @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: API_SCOPES, isArray: true }) @IsArray() @IsIn(API_SCOPES, { each: true }) scopes!: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsISO8601() expiresAt?: string;
}
class RotateApiKeyDto {
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() revokeOld = false;
}

@ApiTags('API key administration')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@RequireScopes('admin')
@Controller('admin/api-keys')
export class AdminApiKeysController {
  constructor(private readonly credentials: ApiCredentialService) {}

  @Get() @ApiOperation({ summary: 'List API credentials without revealing secret values' })
  list() { return this.credentials.list(); }

  @Post() @ApiOperation({ summary: 'Create an API credential; the plaintext key is returned exactly once' })
  create(@Body() dto: CreateApiKeyDto) {
    return this.credentials.create({ name: dto.name, scopes: dto.scopes, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined });
  }

  @Post(':id/revoke') @ApiOperation({ summary: 'Revoke an API credential immediately' })
  revoke(@Param('id') id: string) { return this.credentials.revoke(id); }

  @Post(':id/rotate') @ApiOperation({ summary: 'Create a replacement credential and optionally revoke the old key' })
  rotate(@Param('id') id: string, @Body() dto: RotateApiKeyDto) { return this.credentials.rotate(id, dto.revokeOld); }
}
