import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
  validateResolvedProjectStack,
} from '../../src/project/project-stack.ts';

import { isProjectManifest, isProjectLayoutEnabled } from '../../src/project/project-manifest.ts';

const manifest = () => ({
  shell: { title: '', logo: '', standalonePageIds: [] },
  runtime: 'origamix' as const,
  layout: { enabled: false, initialVariant: 'side' as const },
  routing: { mode: 'browser' as const, basePath: '/' },
  projectId: 'project_one',
  name: '示例项目',
  framework: 'react',
  materialSet: { id: 'official-antd', version: '1.0.0' },
  pageDirectory: 'pages',
  pages: [{ pageId: 'page_home', name: '首页', slug: 'home' }],
});

describe('project manifest protocol', () => {
  it('accepts the supported project and page format', () => {
    expect(isProjectManifest(manifest())).toBe(true);
    expect(isProjectManifest({ ...manifest(), applicationState: { user: null } })).toBe(false);
    expect(isProjectManifest({ ...manifest(), access: { enabled: false } })).toBe(false);
    expect(isProjectManifest({ ...manifest(), authentication: { enabled: false } })).toBe(false);
    expect(isProjectManifest({ ...manifest(), runtime: undefined })).toBe(false);
    expect(isProjectManifest({ ...manifest(), runtime: 'unknown' })).toBe(false);
    expect(
      isProjectLayoutEnabled({
        ...manifest(),
        shell: { title: '', logo: '', standalonePageIds: [] },
        runtime: 'external',
        layout: { enabled: true, initialVariant: 'side' },
      }),
    ).toBe(false);
    expect(isProjectLayoutEnabled(manifest())).toBe(false);
    expect(
      isProjectManifest({
        ...manifest(),
        layout: { initialVariant: 'side' as const, enabled: true },
      }),
    ).toBe(true);
    expect(
      isProjectLayoutEnabled({
        ...manifest(),
        layout: { initialVariant: 'side' as const, enabled: true },
      }),
    ).toBe(true);
    expect(
      isProjectManifest({
        ...manifest(),
        layout: { initialVariant: 'side' as const, enabled: 'true' },
      }),
    ).toBe(false);
    expect(
      isProjectManifest({
        ...manifest(),
        layout: { enabled: true, initialVariant: 'side' as const },
        routing: { mode: 'hash', basePath: '/admin/' },
      }),
    ).toBe(true);
    expect(
      isProjectManifest({
        ...manifest(),
        routing: { mode: 'browser' as const, basePath: '//external/' },
      }),
    ).toBe(false);
    expect(isProjectManifest({ ...manifest(), layout: { enabled: true, name: 'custom' } })).toBe(
      false,
    );

    expect(resolveProjectStack(manifest())).toEqual(BUILTIN_PROJECT_STACK);
    expect(isProjectManifest({ ...manifest(), materialSet: undefined })).toBe(false);
    expect(() => resolveProjectStack({ ...manifest(), materialSet: undefined })).toThrow();
    expect(validateResolvedProjectStack(BUILTIN_PROJECT_STACK)).toEqual(BUILTIN_PROJECT_STACK);
    expect(
      isProjectManifest({
        ...manifest(),
        materialSet: { id: 'official-antd', version: '1.0.0\n' },
      }),
    ).toBe(false);
    expect(() =>
      validateResolvedProjectStack({
        ...BUILTIN_PROJECT_STACK,
        materialSet: { id: 'official-antd', version: '2.0.0' },
      }),
    ).toThrow('不受当前应用支持');
    expect(
      isProjectManifest({ ...manifest(), materialSet: { id: 'official-antd', version: '01.0.0' } }),
    ).toBe(false);
    expect(
      isProjectManifest({
        ...manifest(),
        materialSet: { id: 'official-antd', version: '1.2.3-beta.1+build.5' },
      }),
    ).toBe(true);
  });

  it.each([null, { pageId: 'invalid' }, { name: '' }, { slug: '../home' }])(
    'rejects malformed page fields: %j',
    (fields) => {
      const value = manifest();
      expect(
        isProjectManifest({
          ...value,
          pages: [fields === null ? null : { ...value.pages[0], ...fields }],
        }),
      ).toBe(false);
    },
  );

  it('rejects page directories outside src', () => {
    expect(isProjectManifest({ ...manifest(), pageDirectory: '../pages' })).toBe(false);
    expect(isProjectManifest({ ...manifest(), pageDirectory: '/pages' })).toBe(false);
  });
});
