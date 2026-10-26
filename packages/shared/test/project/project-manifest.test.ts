import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
  validateResolvedProjectStack,
} from '../../src/project/project-stack.ts';

import { isProjectManifest } from '../../src/project/project-manifest.ts';

const manifest = () => ({
  projectId: 'project_one',
  name: '示例项目',
  framework: 'react',
  uiLibrary: 'antd',
  version: '1.0.0',
  materialSet: 'official-antd',
  pageDirectory: 'pages',
  pages: [{ pageId: 'page_home', name: '首页', slug: 'home' }],
});

describe('project manifest protocol', () => {
  it('accepts the supported project and page format', () => {
    expect(isProjectManifest(manifest())).toBe(true);
    expect(resolveProjectStack(manifest())).toEqual(BUILTIN_PROJECT_STACK);
    expect(isProjectManifest({ ...manifest(), materialSet: undefined })).toBe(false);
    expect(() => resolveProjectStack({ ...manifest(), materialSet: undefined })).toThrow();
    expect(validateResolvedProjectStack(BUILTIN_PROJECT_STACK)).toEqual(BUILTIN_PROJECT_STACK);
    expect(() =>
      resolveProjectStack({
        ...manifest(),
        version: '9.0.0',
      }),
    ).toThrow('9.0.0');
    expect(() => resolveProjectStack({ ...manifest(), materialSet: null })).toThrow();
    expect(() =>
      validateResolvedProjectStack({
        ...BUILTIN_PROJECT_STACK,
        runtime: { id: 'origamix.react', version: '9.0.0' },
      }),
    ).toThrow();
  });

  it.each([{ pageId: 'invalid' }, { name: '' }, { slug: '../home' }])(
    'rejects malformed page fields: %j',
    (fields) => {
      const value = manifest();
      expect(isProjectManifest({ ...value, pages: [{ ...value.pages[0], ...fields }] })).toBe(
        false,
      );
    },
  );

  it('rejects null pages and malformed page fields', () => {
    expect(isProjectManifest({ ...manifest(), pages: [null] })).toBe(false);
    expect(
      isProjectManifest({
        ...manifest(),
        pages: [{ pageId: 'page_home', name: '首页', slug: '../home' }],
      }),
    ).toBe(false);
  });

  it('rejects page directories outside src', () => {
    expect(isProjectManifest({ ...manifest(), pageDirectory: '../pages' })).toBe(false);
    expect(isProjectManifest({ ...manifest(), pageDirectory: '/pages' })).toBe(false);
  });
});
