import { IConfigService } from './configService';

const API_KEY_SECRETS = {
  zai: 'universalQuota.zai.apiKey',
} as const;

export type ProviderId = keyof typeof API_KEY_SECRETS;

export class ApiKeyService {
  constructor(private configService: IConfigService) {}

  async getApiKey(provider: ProviderId): Promise<string | undefined> {
    return this.configService.get(API_KEY_SECRETS[provider]);
  }

  async setApiKey(provider: ProviderId, key: string): Promise<void> {
    await this.configService.store(API_KEY_SECRETS[provider], key);
  }

  async deleteApiKey(provider: ProviderId): Promise<void> {
    await this.configService.delete(API_KEY_SECRETS[provider]);
  }
}
