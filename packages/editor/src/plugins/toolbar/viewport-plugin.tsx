import { defineEditorPlugin } from '../define-editor-plugin';
import { ViewportTools } from './viewport-tools';

export const createViewportPlugin = () =>
  defineEditorPlugin({
    id: 'editor.viewport',
    editor: {
      renderToolbar: ({ area, children }) =>
        area === 'center' ? (
          <>
            <ViewportTools />
            {children}
          </>
        ) : (
          children
        ),
    },
  });
