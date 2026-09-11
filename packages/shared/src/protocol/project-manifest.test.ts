import { describe, expect, it } from 'vitest';
import { isProjectManifest } from './project-manifest';

const manifest = () => ({
  projectId: 'project_one',
  name: '示例项目',
  framework: 'react',
  uiLibrary: 'antd',
  pages: [{ pageId: 'page_home', name: '首页', slug: 'home', route: '/' }],
});

describe('project manifest protocol', () => {
  it('accepts the supported project and page format', () => {
    expect(isProjectManifest(manifest())).toBe(true);
  });

  it('rejects null pages and malformed page fields', () => {
    expect(isProjectManifest({ ...manifest(), pages: [null] })).toBe(false);
    expect(
      isProjectManifest({
        ...manifest(),
        pages: [{ pageId: 'page_home', name: '首页', slug: '../home', route: '/home' }],
      }),
    ).toBe(false);
  });
});
