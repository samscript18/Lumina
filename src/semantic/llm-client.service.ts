import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin wrapper around any OpenAI-compatible /chat/completions endpoint.
 * Provider is fully env-configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL)
 * so swapping providers never requires a code change or redeploy.
 */
@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(private readonly config: ConfigService) {}

  async chatCompletion(messages: ChatMessage[], options?: { temperature?: number }): Promise<string> {
    const baseUrl = this.config.get<string>('llm.baseUrl');
    const apiKey = this.config.get<string>('llm.apiKey');
    const model = this.config.get<string>('llm.model');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'LLM_API_KEY is not configured. Set it in the environment before calling the Semantic Engine.',
      );
    }

    const timeoutMs = this.config.get<number>('requestTimeoutMs') ?? 15_000;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      this.logger.error(`LLM call failed: ${response.status} ${errBody}`);
      throw new InternalServerErrorException(`LLM provider returned ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('LLM provider returned an empty completion');
    }
    return content;
  }
}
