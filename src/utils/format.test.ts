import { describe, test, expect } from 'vitest';
import { formatQuota } from './format';
import { ModelQuota } from '../types';

describe('formatQuota', () => {
  const BASE_MODEL: ModelQuota = { 
    name: 'test', 
    remainingPercent: 50, 
    usedPercent: 50 
  };

  test('returns percent only when no units', () => {
    expect(formatQuota(BASE_MODEL)).toBe('50%');
  });

  test('returns percent only when units incomplete', () => {
    const model = { ...BASE_MODEL, unitName: 'USD' };
    expect(formatQuota(model)).toBe('50%');
  });

  test('formats USD correctly', () => {
    const model = { 
      ...BASE_MODEL, 
      unitName: 'USD', 
      remainingUnits: 2.5, 
      totalUnits: 5.0 
    };
    expect(formatQuota(model)).toBe('50% ($2.50 / $5.00)');
  });

  test('formats generic units correctly', () => {
    const model = { 
      ...BASE_MODEL, 
      unitName: 'requests', 
      remainingUnits: 500, 
      totalUnits: 1000 
    };
    expect(formatQuota(model)).toBe('50% (500 / 1000 requests)');
  });
});
