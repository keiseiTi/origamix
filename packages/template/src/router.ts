// Origamix application shell 1.0.0
import { createElement, type ComponentType } from 'react';
import { createBrowserRouter, Link, Navigate } from 'react-router';
import Application from './application';
import ApplicationError from './application-error';
import manifest from '../origamix.project.json';

const modules = import.meta.glob<{ default: ComponentType }>('./**/index.tsx', { eager: true });
const pages = manifest.pages as Array<{ pageId: string; name: string; slug: string }>;
const routes = pages.map((page) => {
  const Component = modules[`./${manifest.pageDirectory}/${page.slug}/index.tsx`]?.default;
  if (!Component) throw new Error(`页面入口不存在：${page.slug}`);
  return { path: page.slug === 'home' ? '/' : `/${page.slug}`, Component };
});
if (pages.length && !pages.some((page) => page.slug === 'home'))
  routes.push({
    path: '/',
    Component: () => createElement(Navigate, { to: `/${pages[0]!.slug}`, replace: true }),
  });

export default createBrowserRouter([
  {
    Component: Application,
    ErrorBoundary: ApplicationError,
    children: routes.length
      ? [
          ...routes,
          {
            path: '*',
            element: createElement(
              'main',
              { className: 'p-8' },
              createElement('h1', { className: 'text-lg font-semibold' }, '页面不存在'),
              createElement(
                Link,
                { to: '/', className: 'mt-4 inline-block underline focus-visible:outline-2' },
                '返回首页',
              ),
            ),
          },
        ]
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
  },
]);
