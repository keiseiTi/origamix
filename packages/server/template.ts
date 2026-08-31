import { cp, lstat } from 'node:fs/promises';
import { relative, sep } from 'node:path';

const rootFiles = new Set([
  'src', 'index.html', 'package.json', 'vite.config.ts', 'eslint.config.js',
  'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'README.md', '.gitignore'
]);
const excluded = new Set(['node_modules', 'dist', '.git', '.cache', '.DS_Store']);

// Use the same source-only template in development and packaged applications.
export async function copyTemplate(source: string, target: string): Promise<void> {
  await cp(source, target, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: async (path) => {
      const parts = relative(source, path).split(sep);
      if (parts[0] && (!rootFiles.has(parts[0]) || parts.some((part) => excluded.has(part)))) return false;
      return !(await lstat(path)).isSymbolicLink();
    }
  });
}
