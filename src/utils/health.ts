import * as vscode from 'vscode';
import { HealthStatus, ModelQuota } from '../types';

export function calculateHealth(remainingPercent: number): HealthStatus {
  if (remainingPercent >= 70) return 'good';
  if (remainingPercent >= 30) return 'warning';
  return 'critical';
}

export function calculateOverallHealth(models: ModelQuota[]): HealthStatus {
  if (models.length === 0) return 'unknown';
  
  const minRemaining = Math.min(...models.map(m => m.remainingPercent));
  return calculateHealth(minRemaining);
}

export function getHealthIcon(health: HealthStatus): string {
  switch (health) {
    case 'good': return '$(check)';
    case 'warning': return '$(warning)';
    case 'critical': return '$(error)';
    case 'unknown': return '$(circle-slash)';
  }
}

export function getHealthEmoji(health: HealthStatus): string {
  switch (health) {
    case 'good': return '🟢';
    case 'warning': return '🟡';
    case 'critical': return '🔴';
    case 'unknown': return '⚫';
  }
}

export function getHealthColor(health: HealthStatus): vscode.ThemeColor | undefined {
  switch (health) {
    case 'good': return undefined;
    case 'warning': return new vscode.ThemeColor('statusBarItem.warningBackground');
    case 'critical': return new vscode.ThemeColor('statusBarItem.errorBackground');
    case 'unknown': return undefined;
  }
}

export function getHealthThemeIcon(health: HealthStatus): vscode.ThemeIcon {
  switch (health) {
    case 'good': return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    case 'warning': return new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
    case 'critical': return new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
    case 'unknown': return new vscode.ThemeIcon('circle-slash');
  }
}

export function getProviderIcon(providerId: string): vscode.ThemeIcon {
  switch (providerId) {
    case 'antigravity':
      return new vscode.ThemeIcon('cloud-upload', new vscode.ThemeColor('charts.purple'));
    case 'claude-code':
      return new vscode.ThemeIcon('terminal', new vscode.ThemeColor('charts.orange'));
    case 'codex':
      return new vscode.ThemeIcon('code', new vscode.ThemeColor('charts.green'));
    case 'gemini-cli':
      return new vscode.ThemeIcon('symbol-event', new vscode.ThemeColor('charts.blue'));
    case 'zai':
      return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.yellow'));
    default:
      return new vscode.ThemeIcon('question');
  }
}
