import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ErrorInterpreterService } from './error-interpreter.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

class DecodeErrorDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional()
  @IsString()
  targetLanguage?: string;
}

class LiveQuoteDto {
  @IsString()
  @MinLength(1)
  chainIndex: string;

  @IsString()
  @MinLength(1)
  amount: string;

  @IsString()
  @MinLength(1)
  fromTokenAddress: string;

  @IsString()
  @MinLength(1)
  toTokenAddress: string;

  @IsOptional()
  @IsIn(['exactIn', 'exactOut'])
  swapMode?: 'exactIn' | 'exactOut';

  @IsOptional()
  @IsString()
  targetLanguage?: string;
}

@UseGuards(ApiKeyGuard)
@Controller('decode-error')
export class ErrorInterpreterController {
  constructor(private readonly errorInterpreterService: ErrorInterpreterService) {}

  @Post()
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
@Controller('onchain')
export class OnchainController {
  constructor(private readonly errorInterpreterService: ErrorInterpreterService) {}

  @Post('quote')
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
