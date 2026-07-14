import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { McpServerService } from './mcp-server.service';
import { RequireScopes } from '../access/scopes.decorator';
import { ApiExcludeController } from '@nestjs/swagger';

@UseGuards(ApiKeyGuard)
@RequireScopes('mcp')
@ApiExcludeController()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpServerService) {}

  @All()
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.mcp.handleStreamableHttp(request, response, request.body);
  }
}
