# TDD: Quota Units Reporting

## Initial ask
Report units (e.g. requests, USD) alongside percentages.

## Data models

```typescript
// src/types.ts

export interface ModelQuota {
  name: string;
  displayName?: string;
  remainingPercent: number;  // 0-100
  usedPercent: number;       // 0-100
  resetTime?: Date;
  trend?: TrendDirection;
  
  // [🟢 NEW]
  remainingUnits?: number;
  totalUnits?: number;
  unitName?: string; // 'USD', 'requests', 'tokens', etc.
}
```

## Pseudocode breakdown

**Unit Formatting Helper**

```typescript
// src/utils/format.ts [🟢 NEW]

// [A]
formatQuota(model: ModelQuota): string
  base = `${model.remainingPercent}%`
  if !model.unitName: return base
  
  if model.unitName == 'USD':
    // [B]
    return `${base} ($${model.remainingUnits.toFixed(2)} / $${model.totalUnits.toFixed(2)})`
  
  // [C]
  return `${base} (${model.remainingUnits} / ${model.totalUnits} ${model.unitName})`
```

**VS Code View Update**

```typescript
// src/views/quotaTreeProvider.ts [🟡 UPDATED]

configureModel(model)
  // [D]
  this.description = formatQuota(model) + timeUntil...
  
  tooltipLines = [...]
  if model.unitName:
    // [E]
    tooltipLines.push(`Units: ${model.remainingUnits} / ${model.totalUnits} ${model.unitName}`)
```

## Files

**New files:**
- `src/utils/format.ts`
- `src/utils/format.test.ts`

**Modified files:**
- `src/types.ts`
- `src/providers/claude-code.ts`
- `src/views/quotaTreeProvider.ts`
- `src/cli/tableFormatter.ts`

## Testing strategy

### Running tests
- `npm run test` (if available) or `npx vitest`

### src/utils/format.test.ts [🟢 NEW]

```typescript
import { formatQuota } from './format';

describe('formatQuota', () => {
  // TP1: Use constants for base objects
  const BASE_MODEL = { 
    name: 'test', 
    remainingPercent: 50, 
    usedPercent: 50 
  };

  test('returns percent only when no units', () => {
    expect(formatQuota(BASE_MODEL)).toBe('50%');
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
```

## Open questions
None.
