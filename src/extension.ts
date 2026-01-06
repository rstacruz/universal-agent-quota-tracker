import * as vscode from 'vscode';
import { ProviderRegistry } from './providers';
import { QuotaTreeProvider } from './views/quotaTreeProvider';
import { QuotaStatusBar } from './views/statusBar';
import { RefreshManager, ApiKeyService } from './services';
import { setZaiApiKey } from './providers/zai';

let refreshManager: RefreshManager | undefined;
let apiKeyService: ApiKeyService | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Universal Agent Quota extension is activating');

  const registry = new ProviderRegistry();
  const treeProvider = new QuotaTreeProvider(registry);
  const statusBar = new QuotaStatusBar(registry);
  apiKeyService = new ApiKeyService(context.secrets);

  refreshManager = new RefreshManager(
    registry,
    treeProvider,
    statusBar
  );

  const treeView = vscode.window.createTreeView('universalQuotaView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  const refreshCommand = vscode.commands.registerCommand(
    'universalQuota.refresh',
    () => refreshManager?.refresh()
  );

  const showDetailsCommand = vscode.commands.registerCommand(
    'universalQuota.showDetails',
    () => vscode.commands.executeCommand('universalQuotaView.focus')
  );

  const configureCommand = vscode.commands.registerCommand(
    'universalQuota.configure',
    () => vscode.commands.executeCommand('workbench.action.openSettings', 'universalQuota')
  );

  const setZaiKeyCommand = vscode.commands.registerCommand(
    'universalQuota.setZaiApiKey',
    async () => {
      if (!apiKeyService) return;
      const success = await apiKeyService.promptForApiKey('zai');
      if (success) {
        const key = await apiKeyService.getApiKey('zai');
        setZaiApiKey(key);
        await refreshManager?.refresh();
      }
    }
  );

  loadStoredApiKeys(context.secrets);

  refreshManager.startAutoRefresh();
  refreshManager.refresh();

  context.subscriptions.push(
    treeView,
    refreshCommand,
    showDetailsCommand,
    configureCommand,
    setZaiKeyCommand,
    statusBar,
    refreshManager
  );

  console.log('Universal Agent Quota extension activated');
}

async function loadStoredApiKeys(secrets: vscode.SecretStorage): Promise<void> {
  const zaiKey = await secrets.get('universalQuota.zai.apiKey');
  if (zaiKey) {
    setZaiApiKey(zaiKey);
  }
}

export function deactivate() {
  refreshManager?.dispose();
  console.log('Universal Agent Quota extension deactivated');
}
