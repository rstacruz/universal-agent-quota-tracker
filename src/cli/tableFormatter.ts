import Table from 'cli-table3';
import { ProviderQuotaResult } from '../types';

export function formatTable(results: ProviderQuotaResult[]): string {
  const table = new Table({
    head: ['Provider', 'Model', 'Remaining', 'Reset', 'Health'],
    style: {
      head: ['cyan'],
    },
    wordWrap: true,
  });

  results.forEach(provider => {
    if (provider.status === 'error' || provider.error) {
      table.push([
        provider.displayName,
        '-',
        provider.error || 'Error',
        '-',
        '❌'
      ]);
      return;
    }

    if (provider.status === 'not_configured') {
       table.push([
         provider.displayName,
         '-',
         'Not Configured',
         '-',
         '⚪'
       ]);
       return;
    }

    if (!provider.accounts || provider.accounts.length === 0) {
       table.push([
         provider.displayName,
         '-',
         'No data',
         '-',
         '❓'
       ]);
       return;
    }

    provider.accounts.forEach(account => {
      account.models.forEach(model => {
        table.push([
          provider.displayName,
          model.displayName || model.name,
          `${model.remainingPercent.toFixed(0)}%`,
          model.resetTime ? new Date(model.resetTime).toLocaleString() : '-',
          getHealthEmoji(model.remainingPercent)
        ]);
      });
    });
  });

  return table.toString();
}

function getHealthEmoji(percent: number): string {
  if (percent >= 50) return '🟢';
  if (percent >= 20) return '🟡';
  return '🔴';
}
