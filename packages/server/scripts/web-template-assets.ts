import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

export const loadWebTemplate = async (directory: string) => {
  const { version, file, sha256, size } = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  );
  if (
    typeof version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(version) ||
    file !== `origamix-template-${version}.zip`
  )
    throw new Error('Web 模板清单无效');
  const body = await readFile(join(directory, file));
  if (size !== body.length || sha256 !== createHash('sha256').update(body).digest('hex'))
    throw new Error('Web 模板 ZIP 校验失败');

  unzipSync(body, {
    filter: ({ name }) => {
      const parts = name.replace(/\/$/, '').split('/');
      if (parts.some((part) => !part || part === '.' || part === '..' || /[\\:\0]/.test(part)))
        throw new Error('Web 模板包含无效路径');
      // Validate the archive paths without extracting the files.
      return false;
    },
  });
  return { version, sha256: String(sha256), body };
};
