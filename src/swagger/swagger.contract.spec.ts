import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TranslationController } from '../translation/translation.controller';
import { TranslationService } from '../translation/translation.service';
import { ErrorInterpreterController, OnchainController } from '../error-interpreter/error-interpreter.controller';
import { ErrorInterpreterService } from '../error-interpreter/error-interpreter.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

describe('Swagger contract', () => {
  let app: INestApplication;

  afterEach(async () => app?.close());

  it('publishes the supported REST operations and request schemas', async () => {
    const module = await Test.createTestingModule({
      controllers: [TranslationController, ErrorInterpreterController, OnchainController],
      providers: [
        { provide: TranslationService, useValue: {} },
        { provide: ErrorInterpreterService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        ApiKeyGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Lumina').setVersion('1').addBearerAuth().build());
    expect(document.paths['/api/v1/translate/string']?.post).toBeDefined();
    expect(document.paths['/api/v1/translate/file']?.post).toBeDefined();
    expect(document.paths['/api/v1/decode-error']?.post).toBeDefined();
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(expect.arrayContaining(['TranslateStringDto', 'TranslateFileDto', 'DecodeErrorDto']));
  });
});
