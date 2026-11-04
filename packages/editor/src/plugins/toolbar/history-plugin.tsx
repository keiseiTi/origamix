import { defineEditorPlugin } from '../define-editor-plugin';
import { HistoryTools } from './history-tools';

export const createHistoryPlugin = () =>
  defineEditorPlugin({
    id: 'editor.history',
    editor: {
      renderToolbar: ({ area, children }) =>
        area === 'center' ? (
          <>
            <HistoryTools />
            {children}
          </>
        ) : (
          children
        ),
    },
  });
