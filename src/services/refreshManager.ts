import * as vscode from 'vscode';
import { ProviderRegistry } from '../providers';
import { QuotaTreeProvider } from '../views/quotaTreeProvider';
import { QuotaStatusBar } from '../views/statusBar';

export class RefreshManager implements vscode.Disposable {
  private timer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private registry: ProviderRegistry,
    private treeProvider: QuotaTreeProvider,
    private statusBar: QuotaStatusBar,
    private notificationCallback?: (results: import('../types').ProviderQuotaResult[]) => void
  ) {
    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('universalQuota.refreshInterval')) {
          this.restartAutoRefresh();
        }
      })
    );
  }

  async refresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          title: 'Refreshing quota data...',
        },
        async () => {
          const results = await this.registry.fetchAll();
          
          // Update UI
          this.treeProvider.refresh();
          this.statusBar.update();

          // Trigger notifications if callback provided
          if (this.notificationCallback) {
            this.notificationCallback(results);
          }
        }
      );
    } catch (error) {
      console.error('Failed to refresh quota:', error);
    } finally {
      this.isRefreshing = false;
    }
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();

    const config = vscode.workspace.getConfiguration('universalQuota');
    const interval = config.get<number>('refreshInterval', 300000); // Default 5 minutes

    this.timer = setInterval(() => {
      if (!this.isRefreshing) {
        this.refresh();
      }
    }, interval);
  }

  stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restartAutoRefresh(): void {
    this.stopAutoRefresh();
    this.startAutoRefresh();
  }

  dispose(): void {
    this.stopAutoRefresh();
    this.disposables.forEach(d => d.dispose());
  }
}
