import * as vscode from 'vscode';
import { ProviderRegistry } from '../providers';
import { getHealthColor } from '../utils/health-vscode';

export class QuotaStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private registry: ProviderRegistry) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'universalQuota.showDetails';
    this.statusBarItem.name = 'Universal Agent Quota';
    this.update();
  }

  update(): void {
    const text = this.registry.getStatusBarText();
    const health = this.registry.getOverallHealth();

    this.statusBarItem.text = `$(cloud)`;
    this.statusBarItem.tooltip = this.registry.getStatusBarTooltip();
    this.statusBarItem.backgroundColor = getHealthColor(health);
    this.statusBarItem.show();
  }

  show(): void {
    this.statusBarItem.show();
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
