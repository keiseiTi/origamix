import { defineEditorPlugin } from '../define-editor-plugin';
import { ModeTools } from './mode-tools';

export const createEditorModePlugin = () =>
  defineEditorPlugin({
    id: 'editor.mode',
    editor: {
      renderToolbar: ({ area, children }) =>
        area === 'center' ? (
          <>
            <ModeTools />
            {children}
          </>
        ) : (
          children
        ),
    },
  });
