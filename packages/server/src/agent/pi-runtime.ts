import { createModels } from '@earendil-works/pi-ai';
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek';
import { minimaxCnProvider } from '@earendil-works/pi-ai/providers/minimax-cn';
import { minimaxProvider } from '@earendil-works/pi-ai/providers/minimax';
import { qwenTokenPlanCnProvider } from '@earendil-works/pi-ai/providers/qwen-token-plan-cn';
import { qwenTokenPlanProvider } from '@earendil-works/pi-ai/providers/qwen-token-plan';
import { zaiCodingCnProvider } from '@earendil-works/pi-ai/providers/zai-coding-cn';
import { zaiProvider } from '@earendil-works/pi-ai/providers/zai';
import type { ModelProviderOption } from '@origamix/shared';

export const defaultModelReference = {
  provider: 'deepseek',
  model: 'deepseek-flash',
} as const;

const providers = [
  { provider: deepseekProvider(), name: 'DeepSeek' },
  { provider: zaiCodingCnProvider(), name: 'Z.AI Coding Plan · 中国站' },
  { provider: zaiProvider(), name: 'Z.AI Coding Plan · 国际站' },
  { provider: minimaxCnProvider(), name: 'MiniMax · 中国站' },
  { provider: minimaxProvider(), name: 'MiniMax · 国际站' },
  { provider: qwenTokenPlanCnProvider(), name: 'Qwen Token Plan · 中国站' },
  { provider: qwenTokenPlanProvider(), name: 'Qwen Token Plan · 国际站' },
];

export const modelProviders: readonly ModelProviderOption[] = providers.map(
  ({ provider, name }) => ({
    id: provider.id,
    name,
    models: provider.getModels().map(({ id, name }) => ({ id, name })),
  }),
);

export const createPiModels = () => {
  const models = createModels();
  for (const { provider } of providers) models.setProvider(provider);
  const model = models.getModel(defaultModelReference.provider, defaultModelReference.model);
  if (!model) throw new Error('Pi 模型目录缺少默认模型');
  return { model, models };
};
