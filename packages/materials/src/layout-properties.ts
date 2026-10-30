/** Validated platform layout props, consumed by Runtime rather than page components. */
export const layoutProperties = {
  layoutWidth: {
    type: 'string',
    enum: ['auto', 'fill', 'fixed'],
    description: '元素宽度：内容、自适应父级或固定像素。',
  },
  layoutHeight: { type: 'string', enum: ['auto', 'fill', 'fixed'] },
  layoutFixedWidth: { type: 'number', minimum: 0 },
  layoutFixedHeight: { type: 'number', minimum: 0 },
  layoutGrow: { type: 'number', minimum: 0 },
  layoutAlignSelf: {
    type: 'string',
    enum: ['auto', 'flex-start', 'center', 'flex-end', 'stretch'],
  },
} as const;
