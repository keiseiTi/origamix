import { nanoid } from 'nanoid';

export const isMacDesktop = (): boolean => window.api?.platform === 'darwin';

export const uniqueId = (len?: number) => nanoid(len);

export const workbenchHost = () => __ORIGAMIX_WORKBENCH_HOST__;
