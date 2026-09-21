import { describe, expect, it, vi } from 'vitest';
import { ScopeRouter } from '../../agent/scope-router';

describe('ScopeRouter', () => {
  const pageId = 'page_home';
  it.each([
    ['今天天气怎么样', 'out_of_scope'],
    ['创建一个天气展示页面', 'page_modify'],
    ['开发个表格页面', 'page_modify'],
    ['添加表格', 'page_modify'],
    ['添加表格，默认表格就行', 'page_modify'],
    ['重置页面', 'page_modify'],
    ['清空页面内容', 'page_modify'],
    ['重置页面，然后添加表格', 'page_modify'],
    ['加一个天气', 'clarification_required'],
  ] as const)('routes %s to %s', async (message, mode) => {
    expect((await new ScopeRouter().route(message, pageId)).mode).toBe(mode);
  });

  it('keeps classifier below the threshold in clarification mode', async () => {
    const classifier = {
      classify: vi.fn().mockResolvedValue({
        mode: 'page_modify',
        confidence: 0.779,
        normalizedRequirement: '增加内容',
        reason: '可能是修改',
      }),
    };
    expect(
      (await new ScopeRouter({ classifier, classifierThreshold: 0.78 }).route('处理一下', pageId))
        .mode,
    ).toBe('clarification_required');
    expect(classifier.classify).toHaveBeenCalledWith({ message: '处理一下', pageId });
  });

  it('falls back safely when the classifier fails', async () => {
    const classify = vi.fn().mockRejectedValue(new Error('down'));
    expect(
      (await new ScopeRouter({ classifier: { classify } }).route('处理一下', pageId)).mode,
    ).toBe('clarification_required');
  });
});
