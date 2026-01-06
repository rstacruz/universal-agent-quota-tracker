import * as vscode from 'vscode';

const API_KEY_SECRETS = {
  zai: 'universalQuota.zai.apiKey',
} as const;

type ProviderId = keyof typeof API_KEY_SECRETS;

export class ApiKeyService {
  constructor(private secrets: vscode.SecretStorage) {}

  async getApiKey(provider: ProviderId): Promise<string | undefined> {
    return this.secrets.get(API_KEY_SECRETS[provider]);
  }

  async setApiKey(provider: ProviderId, key: string): Promise<void> {
    await this.secrets.store(API_KEY_SECRETS[provider], key);
  }

  async deleteApiKey(provider: ProviderId): Promise<void> {
    await this.secrets.delete(API_KEY_SECRETS[provider]);
  }

  async promptForApiKey(provider: ProviderId): Promise<boolean> {
    const displayNames: Record<ProviderId, string> = {
      zai: 'Z.AI',
    };

    const existing = await this.getApiKey(provider);
    const placeholder = existing ? '(key already set - enter new key to replace)' : 'Enter API key';

    const key = await vscode.window.showInputBox({
      prompt: `Enter your ${displayNames[provider]} API key`,
      placeHolder: placeholder,
      password: true,
      ignoreFocusOut: true,
    });

    if (key === undefined) {
      return false;
    }

    if (key === '') {
      if (existing) {
        const confirm = await vscode.window.showQuickPick(['Yes', 'No'], {
          placeHolder: 'Remove existing API key?',
        });
        if (confirm === 'Yes') {
          await this.deleteApiKey(provider);
          return true;
        }
      }
      return false;
    }

    await this.setApiKey(provider, key);
    return true;
  }
}
