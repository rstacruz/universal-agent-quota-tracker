import { promises as fs } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { BaseQuotaProvider } from './base';
import { ProviderQuotaResult, AccountQuota, ModelQuota } from '../types';
import { calculateOverallHealth } from '../utils/health';

const execAsync = promisify(exec);

const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const ANTIGRAVITY_ENDPOINTS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
];

const ANTIGRAVITY_HEADERS = {
  'User-Agent': `antigravity/1.11.5 ${platform()}/${process.arch}`,
  'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  'Client-Metadata': JSON.stringify({
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI'
  })
};

interface OpencodeAccountV3 {
  email?: string;
  refreshToken: string;
  projectId?: string;
  managedProjectId?: string;
  addedAt: number;
  lastUsed: number;
}

interface OpencodeStorageV3 {
  version: 3;
  accounts: OpencodeAccountV3[];
  activeIndex: number;
}

interface ProxyAccount {
  email: string;
  source: 'oauth' | 'database' | 'manual';
  refreshToken?: string;
  dbPath?: string;
  apiKey?: string;
}

interface ProxyAccountStorage {
  accounts: ProxyAccount[];
  settings?: Record<string, unknown>;
  activeIndex: number;
}

interface QuotaInfo {
  remainingFraction: number | null;
  resetTime: string | null;
}

interface AccountWithToken {
  email: string;
  source: string;
  accessToken: string;
}

export class AntigravityProvider extends BaseQuotaProvider {
  readonly id = 'antigravity';
  readonly displayName = 'Opencode Antigravity Auth';
  readonly shortName = 'AG';

  private getOpencodeStoragePath(): string {
    if (process.platform === 'win32') {
      return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'opencode', 'antigravity-accounts.json');
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    return join(xdgConfig, 'opencode', 'antigravity-accounts.json');
  }

  private getProxyAccountsPath(): string {
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
    return join(xdgConfig, 'antigravity-proxy', 'accounts.json');
  }

  private getAntigravityIdeDatabasePath(): string {
    const home = homedir();
    switch (process.platform) {
      case 'darwin':
        return join(home, 'Library/Application Support/Antigravity/User/globalStorage/state.vscdb');
      case 'win32':
        return join(home, 'AppData/Roaming/Antigravity/User/globalStorage/state.vscdb');
      default:
        return join(home, '.config/Antigravity/User/globalStorage/state.vscdb');
    }
  }

  async isConfigured(): Promise<boolean> {
    const sources = await this.getAllAccountSources();
    return sources.length > 0;
  }

  private async getAllAccountSources(): Promise<AccountWithToken[]> {
    const accounts: AccountWithToken[] = [];

    const opencodeAccounts = await this.loadOpencodeAccounts();
    for (const acc of opencodeAccounts) {
      const token = await this.refreshToken(acc.refreshToken);
      if (token) {
        accounts.push({
          email: acc.email || 'opencode-account',
          source: 'opencode',
          accessToken: token,
        });
      }
    }

    const proxyAccounts = await this.loadProxyAccounts();
    for (const acc of proxyAccounts) {
      if (acc.source === 'oauth' && acc.refreshToken) {
        const token = await this.refreshToken(acc.refreshToken);
        if (token) {
          accounts.push({
            email: acc.email,
            source: 'proxy-oauth',
            accessToken: token,
          });
        }
      } else if (acc.source === 'database' && acc.dbPath) {
        const token = await this.extractTokenFromDatabase(acc.dbPath);
        if (token) {
          accounts.push({
            email: acc.email,
            source: 'proxy-db',
            accessToken: token,
          });
        }
      }
    }

    const ideToken = await this.extractTokenFromDatabase(this.getAntigravityIdeDatabasePath());
    if (ideToken) {
      const existingIde = accounts.find(a => a.source === 'antigravity-ide');
      if (!existingIde) {
        accounts.push({
          email: 'Antigravity IDE',
          source: 'antigravity-ide',
          accessToken: ideToken,
        });
      }
    }

    return accounts;
  }

  private async loadOpencodeAccounts(): Promise<OpencodeAccountV3[]> {
    try {
      const content = await fs.readFile(this.getOpencodeStoragePath(), 'utf-8');
      const storage = JSON.parse(content) as OpencodeStorageV3;
      return storage.accounts || [];
    } catch {
      return [];
    }
  }

  private async loadProxyAccounts(): Promise<ProxyAccount[]> {
    try {
      const content = await fs.readFile(this.getProxyAccountsPath(), 'utf-8');
      const storage = JSON.parse(content) as ProxyAccountStorage;
      return storage.accounts || [];
    } catch {
      return [];
    }
  }

  private async extractTokenFromDatabase(dbPath: string): Promise<string | null> {
    try {
      await fs.access(dbPath);
      
      const query = `SELECT value FROM ItemTable WHERE key = 'antigravityAuthStatus'`;
      const { stdout } = await execAsync(`sqlite3 "${dbPath}" "${query}"`, { timeout: 5000 });
      
      if (!stdout.trim()) return null;

      const authData = JSON.parse(stdout.trim());
      return authData.apiKey || null;
    } catch {
      return null;
    }
  }

  async fetchQuota(): Promise<ProviderQuotaResult> {
    try {
      const accountSources = await this.getAllAccountSources();

      if (accountSources.length === 0) {
        return this.createNotConfiguredResult("Run 'opencode auth login' or install Antigravity IDE");
      }

      const accounts: AccountQuota[] = [];

      for (const account of accountSources) {
        try {
          const models = await this.fetchModelQuotas(account.accessToken);
          accounts.push({
            id: account.email,
            name: account.email,
            models,
            overallHealth: calculateOverallHealth(models),
          });
        } catch {
          accounts.push({
            id: account.email,
            name: account.email,
            models: [],
            overallHealth: 'unknown',
          });
        }
      }

      return {
        provider: this.id,
        displayName: this.displayName,
        shortName: this.shortName,
        status: 'ok',
        accounts,
        lastUpdated: new Date(),
      };
    } catch (error) {
      return this.createErrorResult(String(error));
    }
  }

  private async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: ANTIGRAVITY_CLIENT_ID,
          client_secret: ANTIGRAVITY_CLIENT_SECRET,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json() as { access_token: string };
      return data.access_token;
    } catch {
      return null;
    }
  }

  private async fetchModelQuotas(accessToken: string): Promise<ModelQuota[]> {
    for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...ANTIGRAVITY_HEADERS,
          },
          body: '{}',
        });
        if (!response.ok) continue;

        const data = await response.json() as { models?: Record<string, { quotaInfo?: QuotaInfo }> };
        
        const groups: Record<string, { remaining: number; resetTime?: Date; count: number }> = {
          'Gemini 3 Flash': { remaining: 100, count: 0 },
          'Gemini 3 Pro': { remaining: 100, count: 0 },
          'Claude / GPT': { remaining: 100, count: 0 },
        };

        for (const [modelId, modelInfo] of Object.entries(data.models || {})) {
          const remainingFraction = modelInfo.quotaInfo?.remainingFraction ?? 1;
          const remainingPercent = Math.round(remainingFraction * 100);
          const resetTime = modelInfo.quotaInfo?.resetTime ? new Date(modelInfo.quotaInfo.resetTime) : undefined;

          let groupKey: string | null = null;
          if (modelId.includes('gemini-3') && modelId.includes('flash')) {
            groupKey = 'Gemini 3 Flash';
          } else if (modelId.includes('gemini-3') && modelId.includes('pro')) {
            groupKey = 'Gemini 3 Pro';
          } else if (modelId.includes('claude') || modelId.includes('gpt')) {
            groupKey = 'Claude / GPT';
          }

          if (groupKey) {
            groups[groupKey].count++;
            if (remainingPercent < groups[groupKey].remaining) {
              groups[groupKey].remaining = remainingPercent;
              groups[groupKey].resetTime = resetTime;
            }
          }
        }

        return Object.entries(groups)
          .filter(([, g]) => g.count > 0)
          .map(([name, g]) => ({
            name,
            displayName: name,
            remainingPercent: g.remaining,
            usedPercent: 100 - g.remaining,
            resetTime: g.resetTime,
          }));
      } catch {
        continue;
      }
    }
    return [];
  }

  private formatModelName(modelId: string): string {
    return modelId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
