import type { AttributeConfig } from '../src/material';

export const containerLayoutConfigs: AttributeConfig[] = [
  {
    field: 'display',
    label: '布局方式',
    uiType: 'select',
    props: {
      options: [
        { label: '流式布局', value: 'flow' },
        { label: '弹性布局', value: 'flex' },
      ],
    },
  },
  ...(
    [
      [
        'flexDirection',
        '排列方向',
        [
          ['纵向', 'column'],
          ['横向', 'row'],
        ],
      ],
      [
        'flexWrap',
        '换行',
        [
          ['不换行', 'nowrap'],
          ['自动换行', 'wrap'],
        ],
      ],
      [
        'alignItems',
        '交叉轴对齐',
        [
          ['拉伸', 'stretch'],
          ['起点', 'flex-start'],
          ['居中', 'center'],
          ['终点', 'flex-end'],
        ],
      ],
      [
        'justifyContent',
        '主轴对齐',
        [
          ['起点', 'flex-start'],
          ['居中', 'center'],
          ['终点', 'flex-end'],
          ['两端对齐', 'space-between'],
          ['均匀分布', 'space-around'],
        ],
      ],
    ] as const
  ).map(([field, label, options]) => ({
    field,
    label,
    uiType: 'select' as const,
    props: { options: options.map(([label, value]) => ({ label, value })) },
    linkageShow: [{ field: 'display', value: 'flex' }],
  })),
  {
    field: 'gap',
    label: '间距（px）',
    uiType: 'number',
    props: { min: 0 },
    linkageShow: [{ field: 'display', value: 'flex' }],
  },
  { field: 'padding', label: '内边距（px）', uiType: 'number', props: { min: 0 } },
];
