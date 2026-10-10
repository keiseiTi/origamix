import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  lang: 'zh',
  title: 'Origamix',
  description:
    'AI 驱动、本地优先的低代码编辑器。项目介绍、源码启动、使用指南与包架构。',
  logo: '/icon.png',
  logoText: 'Origamix',
  themeConfig: {
    darkMode: 'light',
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/keiseiTi/origamix',
      },
    ],
  },
});
