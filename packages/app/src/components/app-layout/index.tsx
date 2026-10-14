import type { ReactNode } from 'react';
import { usePreferencesStore } from '@/store/preferences';

export const AppLayout = ({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}): React.JSX.Element => {
  const theme = usePreferencesStore((state) => state.theme);

  return (
    <main
      className='flex h-full w-full overflow-hidden bg-white text-[13px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
      data-theme={theme}
    >
      {sidebar}
      {children}
    </main>
  );
};
