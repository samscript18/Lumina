import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ErrorInterpreterService } from './error-interpreter.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '../access/scopes.decorator';

class DecodeErrorDto {
  @ApiProperty({ example: 'INSUFFICIENT_OUTPUT_AMOUNT' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'zh-CN', required: false })
  @IsOptional()
  @IsString()
  targetLanguage?: string;
}

class LiveQuoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  chainIndex!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fromTokenAddress!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  toTokenAddress!: string;

  @ApiProperty({ enum: ['exactIn', 'exactOut'], required: false })
  @IsOptional()
  @IsIn(['exactIn', 'exactOut'])
  swapMode?: 'exactIn' | 'exactOut';

  @ApiProperty({ required: false, example: 'fr' })
  @IsOptional()
  @IsString()
  targetLanguage?: string;
}

@UseGuards(ApiKeyGuard)
@RequireScopes('decode')
@ApiTags('Onchain errors')
@ApiBearerAuth()
@Controller('decode-error')
export class ErrorInterpreterController {
  constructor(private readonly errorInterpreterService: ErrorInterpreterService) {}

  @Post()
  @ApiOperation({ summary: 'Decode and localize an OKX/EVM execution error' })
  async decode(@Body() dto: DecodeErrorDto) {
    return this.errorInterpreterService.decode(dto.code, dto.targetLanguage ?? 'en');
  }
}

/**
 * Separate controller (kept under /onchain, not /decode-error) for the live,
 * authenticated call to OKX OnchainOS — distinct from the pure-lookup
 * decode-error endpoint above, since it requires OKX credentials and makes
 * a real outbound network call.
 */
@UseGuards(ApiKeyGuard)
@RequireScopes('quote')
@ApiTags('OnchainOS')
@ApiBearerAuth()
@Controller('onchain')
export class OnchainController {
  constructor(private readonly errorInterpreterService: ErrorInterpreterService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Request a live OKX OnchainOS swap quote' })
  async liveQuote(@Body() dto: LiveQuoteDto) {
    return this.errorInterpreterService.getLiveQuote(
      {
        chainIndex: dto.chainIndex,
        amount: dto.amount,
        fromTokenAddress: dto.fromTokenAddress,
        toTokenAddress: dto.toTokenAddress,
        swapMode: dto.swapMode,
      },
      dto.targetLanguage ?? 'en',
    );
  }
}
