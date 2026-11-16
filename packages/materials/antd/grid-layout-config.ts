import type { AttributeConfig } from '../src/material';

export const gridColumnCounts = ['2', '3', '4', '6'] as const;

export const gridColumnsConfig = {
  field: 'gridColumns',
  label: '栅格列数',
  uiType: 'select',
  props: {
    options: gridColumnCounts.map((value) => ({ label: `${value} 列`, value })),
  },
} satisfies AttributeConfig;
