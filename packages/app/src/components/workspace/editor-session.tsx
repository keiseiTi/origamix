import { useState, type RefObject } from 'react';
import type { PageItem } from '../sidebar';
import { EditorWorkspace, type EditorHandle } from './editor-workspace';

const ignoreStatus = (): void => undefined;

// Retain each visited page's editor DOM so mode/page switches preserve its viewport.
// Schemas still load and commit through the same revision-backed service.
export function EditorSession({
  projectId,
  page,
  visible,
  editorRef,
  onStatusChange,
}: {
  projectId: string;
  page: PageItem;
  visible: boolean;
  editorRef: RefObject<EditorHandle | null>;
  onStatusChange: (status: string) => void;
}): React.JSX.Element {
  const key = `${projectId}:${page.id}`;
  const [pages, setPages] = useState([{ key, projectId, page }]);
  if (!pages.some((entry) => entry.key === key)) {
    setPages([...pages, { key, projectId, page }]);
  }
  return (
    <>
      {pages.map((entry) => (
        <div
          key={entry.key}
          className={visible && entry.key === key ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
        >
          <EditorWorkspace
            ref={entry.key === key ? editorRef : undefined}
            projectId={entry.projectId}
            pageId={entry.page.id}
            fileName={entry.page.fileName}
            onStatusChange={entry.key === key ? onStatusChange : ignoreStatus}
          />
        </div>
      ))}
    </>
  );
}
