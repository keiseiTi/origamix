export const containerLayoutProperties = {
  display: { type: 'string', enum: ['flow', 'flex'] },
  flexDirection: { type: 'string', enum: ['column', 'row'] },
  gap: { type: 'number', minimum: 0 },
  flexWrap: { type: 'string', enum: ['nowrap', 'wrap'] },
  alignItems: { type: 'string', enum: ['stretch', 'flex-start', 'center', 'flex-end'] },
  justifyContent: {
    type: 'string',
    enum: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'],
  },
} as const;
