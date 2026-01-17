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

export function getHealthEmoji(health: HealthStatus): string {
  switch (health) {
    case 'good': return '🟢';
    case 'warning': return '🟡';
    case 'critical': return '🔴';
    case 'unknown': return '⚫';
  }
}
