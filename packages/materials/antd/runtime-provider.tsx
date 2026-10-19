import { ConfigProvider, theme } from 'antd';
import type { ReactNode } from 'react';

/** Material-family theme boundary for hosts rendering Ant Design pages. */
export const RuntimeProvider = ({
  children,
  mode = 'light',
}: {
  children: ReactNode;
  mode?: 'light' | 'dark';
}) => (
  <ConfigProvider
    theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}
  >
    {children}
  </ConfigProvider>
);
