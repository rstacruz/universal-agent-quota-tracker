import { promises as fs } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { BaseQuotaProvider } from './base';
import { ProviderQuotaResult, AccountQuota, ModelQuota } from '../types';
import { calculateOverallHealth } from '../utils/health-core';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const DEFAULT_5_HOUR_LIMIT_USD = 5.0;

const PRICING = {
  'claude-opus-4-5-20251101': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  default: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
};

interface ClaudeUsageEntry {
  timestamp: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  type?: string;
}

interface FiveHourBlock {
  startTime: Date;
  endTime: Date;
  costUSD: number;
}

function calculateCost(entry: ClaudeUsageEntry): number {
  const usage = entry.message?.usage;
  if (!usage) return 0;

  const model = entry.message?.model || 'default';
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING.default;

  const inputCost = (usage.input_tokens || 0) * pricing.input / 1_000_000;
  const outputCost = (usage.output_tokens || 0) * pricing.output / 1_000_000;
  const cacheWriteCost = (usage.cache_creation_input_tokens || 0) * pricing.cacheWrite / 1_000_000;
  const cacheReadCost = (usage.cache_read_input_tokens || 0) * pricing.cacheRead / 1_000_000;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export class ClaudeCodeProvider extends BaseQuotaProvider {
  readonly id = 'claude-code';
  readonly displayName = 'Claude Code';
  readonly shortName = 'CC';

  private async findAllJsonlFiles(): Promise<string[]> {
    const jsonlFiles: string[] = [];

    try {
      const projectsStat = await stat(PROJECTS_DIR);
      if (!projectsStat.isDirectory()) return jsonlFiles;

      const projectDirs = await readdir(PROJECTS_DIR);
      for (const projectDir of projectDirs) {
        const projectPath = join(PROJECTS_DIR, projectDir);
        try {
          const dirStat = await stat(projectPath);
          if (!dirStat.isDirectory()) continue;

          const files = await readdir(projectPath);
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              jsonlFiles.push(join(projectPath, file));
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      return jsonlFiles;
    }

    return jsonlFiles;
  }

  private async loadRecentEntries(): Promise<ClaudeUsageEntry[]> {
    const entries: ClaudeUsageEntry[] = [];
    const fiveHoursAgo = Date.now() - FIVE_HOURS_MS;
    const jsonlFiles = await this.findAllJsonlFiles();

    for (const filePath of jsonlFiles) {
      try {
        const fileStat = await stat(filePath);
        if (fileStat.mtimeMs < fiveHoursAgo) continue;

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const entry = JSON.parse(trimmed) as ClaudeUsageEntry;
            if (entry.type !== 'assistant' || !entry.message?.usage) continue;

            const entryTime = new Date(entry.timestamp).getTime();
            if (entryTime >= fiveHoursAgo) {
              entries.push(entry);
            }
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }

    return entries;
  }

  private calculateActiveBlockCost(entries: ClaudeUsageEntry[]): FiveHourBlock | null {
    if (entries.length === 0) return null;

    const sorted = [...entries].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const now = Date.now();
    const fiveHoursAgo = now - FIVE_HOURS_MS;

    let totalCost = 0;
    for (const entry of sorted) {
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime >= fiveHoursAgo) {
        totalCost += calculateCost(entry);
      }
    }

    return {
      startTime: new Date(fiveHoursAgo),
      endTime: new Date(now + FIVE_HOURS_MS - (now - fiveHoursAgo)),
      costUSD: totalCost,
    };
  }

  async isConfigured(): Promise<boolean> {
    try {
      const credPath = join(CLAUDE_DIR, '.credentials.json');
      await stat(credPath);
      return true;
    } catch {
      return false;
    }
  }

  async fetchQuota(): Promise<ProviderQuotaResult> {
    try {
      const isConfigured = await this.isConfigured();
      if (!isConfigured) {
        return this.createNotConfiguredResult("Run 'claude' to authenticate");
      }

      const entries = await this.loadRecentEntries();
      const activeBlock = this.calculateActiveBlockCost(entries);

      const costUSD = activeBlock?.costUSD || 0;
      const remainingPercent = Math.max(0, Math.round(100 - (costUSD / DEFAULT_5_HOUR_LIMIT_USD) * 100));

      const models: ModelQuota[] = [{
        name: '5-hour',
        displayName: '5-Hour Window',
        remainingPercent,
        usedPercent: 100 - remainingPercent,
        resetTime: activeBlock?.endTime,
      }];

      const account: AccountQuota = {
        id: 'default',
        name: 'Claude Code',
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
