import { defineEditorPlugin } from '@origamix/editor';
import { WorkspaceToolbar } from './workspace-toolbar';

export const createWorkspaceToolbarPlugin = () =>
  defineEditorPlugin({
    id: 'workspace.toolbar',
    editor: {
      renderToolbar: ({ area, children }) => (area === 'all' ? <WorkspaceToolbar /> : children),
    },
  });
