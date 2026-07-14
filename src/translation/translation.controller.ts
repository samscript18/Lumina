import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TranslationService } from './translation.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

class TranslateStringDto {
  @ApiProperty({ example: 'Swap {amount} ETH' })
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  text!: string;

  @ApiProperty({ example: 'pt-BR' })
  @IsString()
  @MinLength(2)
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
  targetLanguage!: string;
}

class TranslateFileDto {
  @ApiProperty({ description: 'Complete JSON or static TS/JS i18n source' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000000)
  content!: string;

  @ApiProperty({ enum: ['json', 'ts-i18n', 'js-i18n'] })
  @IsIn(['json', 'ts-i18n', 'js-i18n'])
  format!: 'json' | 'ts-i18n' | 'js-i18n';

  @ApiProperty({ example: 'fr' })
  @IsString()
  @MinLength(2)
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
  targetLanguage!: string;
}

@UseGuards(ApiKeyGuard)
@ApiTags('Translation')
@ApiBearerAuth()
@Controller('translate')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('string')
  @ApiOperation({ summary: 'Translate one protected Web3-aware UI string' })
  async translateString(@Body() dto: TranslateStringDto) {
    const translated = await this.translationService.translateString(dto.text, dto.targetLanguage);
    return { translated };
  }

  @Post('file')
  @ApiOperation({ summary: 'Translate a structured localization file' })
  async translateFile(@Body() dto: TranslateFileDto) {
    return this.translationService.translateFile(dto);
  }
}
