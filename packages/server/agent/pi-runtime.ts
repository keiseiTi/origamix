import { createModels } from '@earendil-works/pi-ai';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';

export const mvpModelReference = {
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
} as const;

/**
 * Creates Pi's provider collection without resolving credentials or starting a request.
 * Credential use and the product-facing AgentEngine adapter remain separate boundaries.
 */
export const createMvpPiModels = () => {
  const models = createModels();
  models.setProvider(deepseekProvider());
  const model = models.getModel(mvpModelReference.provider, mvpModelReference.model);
  if (!model) throw new Error('固定模型未包含在当前 Pi provider catalog 中');
  return { model, models };
};
