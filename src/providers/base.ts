import { ProviderQuotaResult, ModelQuota, HealthStatus } from '../types';
import { calculateOverallHealth } from '../utils/health-core';
import { formatTimeUntil } from '../utils/time';

export abstract class BaseQuotaProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly shortName: string;

  abstract isConfigured(): Promise<boolean>;
  abstract fetchQuota(): Promise<ProviderQuotaResult>;

  protected calculateHealth(models: ModelQuota[]): HealthStatus {
    return calculateOverallHealth(models);
  }

  protected formatTimeUntil(date: Date): string {
    return formatTimeUntil(date);
  }

  protected createErrorResult(error: string, hint?: string): ProviderQuotaResult {
    return {
      provider: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      status: 'error',
      accounts: [],
      error,
      hint,
      lastUpdated: new Date(),
    };
  }

  protected createNotConfiguredResult(hint: string): ProviderQuotaResult {
    return {
      provider: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      status: 'not_configured',
      accounts: [],
      hint,
      lastUpdated: new Date(),
    };
  }

  protected createAuthExpiredResult(hint: string): ProviderQuotaResult {
    return {
      provider: this.id,
      displayName: this.displayName,
      shortName: this.shortName,
      status: 'auth_expired',
      accounts: [],
      hint,
      lastUpdated: new Date(),
    };
  }
}
