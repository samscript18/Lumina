import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { McpServerService } from './mcp/mcp-server.service';

async function bootstrap(): Promise<void> {
  process.env.MCP_HTTP_ENABLED = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  await app.get(McpServerService).connectStdio();
}

bootstrap().catch((error) => {
  process.stderr.write(`Lumina MCP stdio failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
