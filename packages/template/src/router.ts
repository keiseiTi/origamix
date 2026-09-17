import { createElement, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import manifest from '../origamix.project.json';

const modules = import.meta.glob<{ default: ComponentType }>('./**/index.tsx', {
  eager: true,
});

const pages = manifest.pages as Array<{
  pageId: string;
  name: string;
  slug: string;
}>;
const pageDirectory = manifest.pageDirectory;
const routes = pages.map((page) => {
  const Component = modules[`./${pageDirectory}/${page.slug}/index.tsx`]?.default;
  if (!Component) throw new Error(`页面入口不存在：${page.slug}`);
  return { path: page.slug === 'home' ? '/' : `/${page.slug}`, Component };
});

export default createBrowserRouter(
  routes.length
    ? routes
    : [
        {
          path: '*',
          element: createElement(
            'main',
            { className: 'p-8' },
            '项目还没有页面，请在 Origamix 中创建。',
          ),
        },
      ],
);
