import { describe, expect, it } from 'vitest';
import { deterministicRunMode } from './deterministic-mvp-dispatcher';

describe('deterministic MVP dispatcher routing', () => {
  it('separates low-code questions, modifications and unrelated prompts', () => {
    expect(deterministicRunMode('今天天气怎么样')).toBe('out_of_scope');
    expect(deterministicRunMode('表格在搭建器里如何配置')).toBe('page_question');
    expect(deterministicRunMode('创建一个客户信息表单')).toBe('page_modify');
  });
});
