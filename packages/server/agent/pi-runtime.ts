import { createModels } from '@earendil-works/pi-ai';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';

export const mvpModelReference = {
  provider: 'deepseek',
  model: 'deepseek-flash',
} as const;

const supportedModelReferences = [
  mvpModelReference,
  { provider: 'deepseek', model: 'deepseek-v4-pro' },
] as const;

/**
 * Creates Pi's provider collection without resolving credentials or starting a request.
 * Credential use and the product-facing AgentEngine adapter remain separate boundaries.
 */
export const createMvpPiModels = () => {
  const models = createModels();
  models.setProvider(deepseekProvider());
  const resolved = supportedModelReferences.map(({ provider, model }) =>
    models.getModel(provider, model),
  );
  if (resolved.some((model) => !model)) {
    throw new Error('支持的模型未完整包含在当前 Pi provider catalog 中');
  }
  const model = resolved[0]!;
  return { model, models };
};
