import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GitHubChangedFile {
  filename: string;
  status: string;
  previous_filename?: string;
}

interface GitHubContent {
  content: string;
  encoding: string;
  sha: string;
}

@Injectable()
export class GitHubClientService {
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly config: ConfigService) {}

  async compare(repository: string, before: string, after: string): Promise<GitHubChangedFile[]> {
    const result = await this.request<{ files?: GitHubChangedFile[] }>(
      `/repos/${repository}/compare/${encodeURIComponent(before)}...${encodeURIComponent(after)}`,
    );
    return result.files ?? [];
  }

  async getTextFile(repository: string, path: string, ref: string): Promise<{ content: string; sha: string } | null> {
    const response = await this.request<GitHubContent>(
      `/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
      { allowNotFound: true },
    );
    if (!response) return null;
    if (response.encoding !== 'base64') throw new ServiceUnavailableException(`Unsupported GitHub encoding for ${path}`);
    return { content: Buffer.from(response.content.replace(/\n/g, ''), 'base64').toString('utf8'), sha: response.sha };
  }

  async createBranch(repository: string, branch: string, fromSha: string): Promise<void> {
    await this.request(`/repos/${repository}/git/refs`, {
      method: 'POST', body: { ref: `refs/heads/${branch}`, sha: fromSha }, allowAlreadyExists: true,
    });
  }

  async putTextFile(repository: string, branch: string, path: string, content: string, sha?: string): Promise<void> {
    await this.request(`/repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: {
        message: `chore(i18n): update ${path}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      },
    });
  }

  async createPullRequest(repository: string, branch: string, base: string, title: string, body: string): Promise<string> {
    const response = await this.request<{ html_url: string }>(`/repos/${repository}/pulls`, {
      method: 'POST', body: { title, body, head: branch, base },
    });
    return response.html_url;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; allowNotFound?: boolean; allowAlreadyExists?: boolean } = {},
  ): Promise<T> {
    const token = this.config.get<string>('github.token');
    if (!token) throw new ServiceUnavailableException('GITHUB_TOKEN is required for GitHub automation');
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Lumina-GitOps',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(this.config.get<number>('requestTimeoutMs') ?? 15_000),
    });
    if (options.allowNotFound && response.status === 404) return null as T;
    if (options.allowAlreadyExists && response.status === 422) return undefined as T;
    if (!response.ok) throw new ServiceUnavailableException(`GitHub API ${options.method ?? 'GET'} ${path} returned ${response.status}`);
    return (await response.json()) as T;
  }
}
