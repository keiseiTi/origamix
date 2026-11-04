import { defineEditorPlugin } from '@origamix/editor';
import type { WorkspaceToolbarProps } from './agent-chat-toolbar';
import { WorkspaceToolbar } from './workspace-toolbar';

export const createWorkspaceToolbarPlugin = () =>
  defineEditorPlugin<WorkspaceToolbarProps>({
    id: 'workspace.toolbar',
    editor: {
      renderToolbar: ({ area, children, props }) =>
        area === 'all' ? <WorkspaceToolbar {...props} /> : children,
    },
  });
