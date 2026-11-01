const rule = (types: string[], value?: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: types },
    ...(value ? { value } : {}),
    message: { type: 'string' },
  },
  required: value ? ['type', 'value'] : ['type'],
});
export const formRuleSchema = {
  type: 'array',
  items: {
    oneOf: [
      rule(['minLength', 'maxLength'], { type: 'integer', minimum: 0 }),
      rule(['min', 'max'], { type: 'number' }),
      rule(['email', 'url']),
      rule(['pattern'], { type: 'string', minLength: 1 }),
    ],
  },
};

export const formFieldProperties = {
  fieldLabel: { type: 'string' },
  fieldTooltip: { type: 'string' },
  fieldRequired: { type: 'boolean' },
  fieldRules: formRuleSchema,
} as const;
