import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { TranslationService } from './translation.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

class TranslateStringDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100000)
  text: string;

  @IsString()
  @MinLength(2)
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
  targetLanguage: string;
}

class TranslateFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000000)
  content: string;

  @IsIn(['json', 'ts-i18n', 'js-i18n'])
  format: 'json' | 'ts-i18n' | 'js-i18n';

  @IsString()
  @MinLength(2)
  @MaxLength(35)
  @Matches(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
  targetLanguage: string;
}

@UseGuards(ApiKeyGuard)
@Controller('translate')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post('string')
  async translateString(@Body() dto: TranslateStringDto) {
    const translated = await this.translationService.translateString(dto.text, dto.targetLanguage);
    return { translated };
  }

  @Post('file')
  async translateFile(@Body() dto: TranslateFileDto) {
    return this.translationService.translateFile(dto);
  }
}
