import { useEffect, useState } from 'react';
import { checkWebSession, isProductionWeb, subscribeWebSession } from '@/services/web-session';

export const WebSessionNotice = () => {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!isProductionWeb()) return;
    const unsubscribe = subscribeWebSession(setExpired);
    let check: AbortController | undefined;
    const resume = () => {
      check?.abort();
      check = new AbortController();
      void checkWebSession(check.signal).catch(() => undefined);
    };
    window.addEventListener('focus', resume);
    return () => {
      unsubscribe();
      check?.abort();
      window.removeEventListener('focus', resume);
    };
  }, []);

  if (!expired) return null;
  return (
    <div
      role='status'
      className='fixed right-4 top-4 z-50 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200'
    >
      会话已结束。
      <a
        className='ml-2 font-medium underline underline-offset-2 focus-visible:outline-2'
        href='/auth/login'
        target='_blank'
        rel='noopener noreferrer'
      >
        在新标签页重新登录
      </a>
    </div>
  );
};
