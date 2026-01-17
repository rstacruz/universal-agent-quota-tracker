import { BaseQuotaProvider } from './base';
import { AntigravityProvider } from './antigravity';
import { ClaudeCodeProvider } from './claude-code';
import { CodexProvider } from './codex';
import { GeminiCliProvider } from './gemini-cli';
import { ZaiProvider } from './zai';
import { ProviderQuotaResult, HealthStatus } from '../types';
import { calculateHealth, getHealthEmoji } from '../utils/health-core';

export class ProviderRegistry {
  private providers: BaseQuotaProvider[];
  private cache: Map<string, ProviderQuotaResult> = new Map();
  private lastFetchTime: Date | null = null;

  constructor() {
    this.providers = [
      new AntigravityProvider(),
      new ClaudeCodeProvider(),
      new CodexProvider(),
      new GeminiCliProvider(),
      new ZaiProvider(),
    ];
  }

  getProviders(): BaseQuotaProvider[] {
    return this.providers;
  }

  async fetchAll(): Promise<ProviderQuotaResult[]> {
    const results = await Promise.allSettled(
      this.providers.map(p => p.fetchQuota())
    );

    const quotaResults: ProviderQuotaResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        this.cache.set(this.providers[index].id, result.value);
        return result.value;
      } else {
        const provider = this.providers[index];
        const errorResult: ProviderQuotaResult = {
          provider: provider.id,
          displayName: provider.displayName,
          shortName: provider.shortName,
          status: 'error',
          accounts: [],
          error: String(result.reason),
          lastUpdated: new Date(),
        };
        this.cache.set(provider.id, errorResult);
        return errorResult;
      }
    });

    this.lastFetchTime = new Date();
    return quotaResults;
  }

  async fetchProvider(id: string): Promise<ProviderQuotaResult | null> {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) return null;

    const result = await provider.fetchQuota();
    this.cache.set(id, result);
    return result;
  }

  getCached(): ProviderQuotaResult[] {
    return Array.from(this.cache.values());
  }

  getCachedProvider(id: string): ProviderQuotaResult | undefined {
    return this.cache.get(id);
  }

  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }

  getOverallHealth(): HealthStatus {
    const results = this.getCached();
    if (results.length === 0) return 'unknown';

    let worstRemaining = 100;
    
    for (const result of results) {
      if (result.status !== 'ok') continue;
      
      for (const account of result.accounts) {
        for (const model of account.models) {
          if (model.remainingPercent < worstRemaining) {
            worstRemaining = model.remainingPercent;
          }
        }
      }
    }

    return calculateHealth(worstRemaining);
  }

  getStatusBarText(): string {
    const parts: string[] = [];

    for (const provider of this.providers) {
      const result = this.cache.get(provider.id);
      
      if (!result || result.status === 'not_configured') {
        parts.push(`${provider.shortName}:--`);
        continue;
      }

      if (result.status === 'error' || result.status === 'auth_expired') {
        parts.push(`${provider.shortName}:!`);
        continue;
      }

      // Get best (highest) remaining percentage across all accounts/models
      let bestRemaining = 0;
      for (const account of result.accounts) {
        for (const model of account.models) {
          if (model.remainingPercent > bestRemaining) {
            bestRemaining = model.remainingPercent;
          }
        }
      }

      parts.push(`${provider.shortName}:${bestRemaining}%`);
    }

    return parts.join(' ');
  }

  getStatusBarTooltip(): string {
    const lines: string[] = ['Universal Agent Quota', '─'.repeat(25)];
    
    for (const provider of this.providers) {
      const result = this.cache.get(provider.id);
      
      if (!result || result.status === 'not_configured') {
        lines.push(`⚫ ${provider.displayName}: Not configured`);
        continue;
      }

      if (result.status === 'error') {
        lines.push(`🔴 ${provider.displayName}: Error`);
        continue;
      }

      if (result.status === 'auth_expired') {
        lines.push(`🟡 ${provider.displayName}: Auth expired`);
        continue;
      }

      let minRemaining = 100;
      let maxRemaining = 0;
      const accountCount = result.accounts.length;

      for (const account of result.accounts) {
        for (const model of account.models) {
          if (model.remainingPercent < minRemaining) {
            minRemaining = model.remainingPercent;
          }
          if (model.remainingPercent > maxRemaining) {
            maxRemaining = model.remainingPercent;
          }
        }
      }

      const health = calculateHealth(minRemaining);
      const emoji = getHealthEmoji(health);

      if (accountCount === 1) {
        lines.push(`${emoji} ${provider.displayName}: ${maxRemaining}%`);
      } else {
        lines.push(`${emoji} ${provider.displayName}: ${minRemaining}-${maxRemaining}% (${accountCount} accounts)`);
      }
    }

    if (this.lastFetchTime) {
      const ago = Math.round((Date.now() - this.lastFetchTime.getTime()) / 60000);
      lines.push('');
      lines.push(`Updated ${ago}m ago • Click for details`);
    }
    
    return lines.join('\n');
  }
}

export { BaseQuotaProvider } from './base';
export { AntigravityProvider } from './antigravity';
export { ClaudeCodeProvider } from './claude-code';
export { CodexProvider } from './codex';
export { GeminiCliProvider } from './gemini-cli';
export { ZaiProvider } from './zai';
