import type { ReactNode } from 'react';
import { PageToolbarShell, type PageToolbarProps } from './page-toolbar';
export type WorkspaceToolbarProps = Omit<
  PageToolbarProps,
  'navigation' | 'children' | 'onOpenEditorTool'
> & { layoutPresets?: ReactNode };
export const AgentChatToolbar = (props: WorkspaceToolbarProps) => (
  <PageToolbarShell {...props} navigation='edit' />
);
