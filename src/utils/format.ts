import { ModelQuota } from '../types';

export function formatQuota(model: ModelQuota): string {
  const base = `${model.remainingPercent}%`;
  
  if (!model.unitName || model.remainingUnits === undefined || model.totalUnits === undefined) {
    return base;
  }
  
  if (model.unitName === 'USD') {
    return `${base} ($${model.remainingUnits.toFixed(2)} / $${model.totalUnits.toFixed(2)})`;
  }
  
  return `${base} (${model.remainingUnits} / ${model.totalUnits} ${model.unitName})`;
}
