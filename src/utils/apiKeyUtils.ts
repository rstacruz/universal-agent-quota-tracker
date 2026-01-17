import * as vscode from 'vscode';
import { ApiKeyService, ProviderId } from '../services/apiKeyService';

export async function promptForApiKey(apiKeyService: ApiKeyService, provider: ProviderId): Promise<boolean> {
  const displayNames: Record<ProviderId, string> = {
    zai: 'Z.AI',
  };

  const existing = await apiKeyService.getApiKey(provider);
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
        await apiKeyService.deleteApiKey(provider);
        return true;
      }
    }
    return false;
  }

  await apiKeyService.setApiKey(provider, key);
  return true;
}
