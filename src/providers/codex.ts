import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { BaseQuotaProvider } from './base';
import { ProviderQuotaResult, AccountQuota, ModelQuota } from '../types';
import { calculateOverallHealth } from '../utils/health-core';

const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

interface CodexAuth {
  api_key?: string;
  tokens?: {
    access_token: string;
    account_id: string;
    refresh_token?: string;
  };
  email?: string;
}

interface CodexWindow {
  limit_window_seconds?: number;
  total_requests?: number;
  total_tokens?: number;
  used_requests?: number;
  used_tokens?: number;
  used_percent?: number;
  reset_after_seconds?: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    limit_reached?: boolean;
    primary_window?: CodexWindow;
    secondary_window?: CodexWindow;
  };
  code_review_rate_limit?: {
    primary_window?: CodexWindow;
  };
}

export class CodexProvider extends BaseQuotaProvider {
  readonly id = 'codex';
  readonly displayName = 'Codex CLI';
  readonly shortName = 'CX';

  private async getCredentials(): Promise<CodexAuth | null> {
    // Try environment variable for API key
    if (process.env.OPENAI_API_KEY) {
      return { api_key: process.env.OPENAI_API_KEY };
    }

    // Try credential files
    const credentialPaths = [
      join(homedir(), '.codex', 'auth.json'),
      join(homedir(), '.config', 'codex', 'auth.json'),
    ];

    for (const credPath of credentialPaths) {
      try {
        const content = await fs.readFile(credPath, 'utf-8');
        return JSON.parse(content) as CodexAuth;
      } catch {
        continue;
      }
    }

    return null;
  }

  async isConfigured(): Promise<boolean> {
    const auth = await this.getCredentials();
    return auth !== null;
  }

  async fetchQuota(): Promise<ProviderQuotaResult> {
    const auth = await this.getCredentials();

    if (!auth) {
      return this.createNotConfiguredResult("Run 'codex login' or set OPENAI_API_KEY");
    }

    // If only API key (no OAuth tokens), can't get quota data
    if (auth.api_key && !auth.tokens) {
      const account: AccountQuota = {
        id: 'api-key',
        name: 'API Key Mode',
        models: [{
          name: 'api-key',
          displayName: 'API Key (no quota data)',
          remainingPercent: 100,
          usedPercent: 0,
        }],
        overallHealth: 'unknown',
      };

      return {
        provider: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        status: 'ok',
        accounts: [account],
        hint: 'API key mode - quota data unavailable',
        lastUpdated: new Date(),
      };
    }

    if (!auth.tokens?.access_token || !auth.tokens?.account_id) {
      return this.createNotConfiguredResult("Run 'codex login' to authenticate");
    }

    try {
      const response = await fetch(CODEX_API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${auth.tokens.access_token}`,
          'chatgpt-account-id': auth.tokens.account_id,
          'User-Agent': 'codex-cli',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        return this.createAuthExpiredResult("Run 'codex login' to re-authenticate");
      }

      if (!response.ok) {
        return this.createErrorResult(`API error: ${response.status}`);
      }

      const data = await response.json() as CodexUsageResponse;
      const models: ModelQuota[] = [];

      if (data.rate_limit?.primary_window) {
        const pw = data.rate_limit.primary_window;
        const usedPercent = pw.used_percent ?? 0;
        models.push({
          name: '5-hour',
          displayName: '5-Hour (Primary)',
          remainingPercent: Math.round(100 - usedPercent),
          usedPercent: Math.round(usedPercent),
          resetTime: pw.reset_after_seconds ? new Date(Date.now() + pw.reset_after_seconds * 1000) : undefined,
        });
      }

      if (data.rate_limit?.secondary_window) {
        const sw = data.rate_limit.secondary_window;
        const usedPercent = sw.used_percent ?? 0;
        models.push({
          name: '7-day',
          displayName: '7-Day (Secondary)',
          remainingPercent: Math.round(100 - usedPercent),
          usedPercent: Math.round(usedPercent),
          resetTime: sw.reset_after_seconds ? new Date(Date.now() + sw.reset_after_seconds * 1000) : undefined,
        });
      }

      const account: AccountQuota = {
        id: auth.email || 'default',
        name: auth.email || 'Codex CLI',
        models,
        overallHealth: calculateOverallHealth(models),
      };

      return {
        provider: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        status: 'ok',
        accounts: [account],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return this.createErrorResult(String(error));
    }
  }
}
