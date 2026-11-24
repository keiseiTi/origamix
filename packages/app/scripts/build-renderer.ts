import { build } from 'vite';

const host = process.argv[2];
if (host !== 'desktop' && host !== 'web') throw new Error('宿主必须为 desktop 或 web');

process.env.ORIGAMIX_HOST = host;
await build();
