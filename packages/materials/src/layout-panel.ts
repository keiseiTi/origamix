import type { PanelConfig } from './material';

export const layoutPanel: PanelConfig = {
  title: '布局',
  configs: [
    ...(['Width', 'Height'] as const).flatMap((dimension) => [
      {
        field: `layout${dimension}`,
        label: dimension === 'Width' ? '宽度' : '高度',
        uiType: 'select' as const,
        props: {
          options: [
            { label: '自动', value: 'auto' },
            { label: '填充父级', value: 'fill' },
            { label: '固定尺寸', value: 'fixed' },
          ],
        },
      },
      {
        field: `layoutFixed${dimension}`,
        label: dimension === 'Width' ? '宽度（px）' : '高度（px）',
        uiType: 'number' as const,
        props: { min: 0 },
        linkageShow: [{ field: `layout${dimension}`, value: 'fixed' }],
      },
    ]),
    { field: 'layoutGrow', label: '剩余空间分配比例', uiType: 'number', props: { min: 0 } },
    {
      field: 'layoutAlignSelf',
      label: '自身交叉轴对齐',
      uiType: 'select',
      props: {
        options: [
          { label: '默认', value: 'auto' },
          { label: '起点', value: 'flex-start' },
          { label: '居中', value: 'center' },
          { label: '终点', value: 'flex-end' },
          { label: '拉伸', value: 'stretch' },
        ],
      },
    },
  ],
};
