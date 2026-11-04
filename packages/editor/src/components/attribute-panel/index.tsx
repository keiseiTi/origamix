import { getElementLabel } from '@origamix/shared';
import { ChevronRight } from 'lucide-react';
import type { EventFocusProps } from '../editor-layout/event-focus-target';
import type { EventTarget } from '../flow-editor/flow-graph';
import { AttributeField } from './attribute-field';
import { EventFields } from './event-fields';
import { ObsoleteFields } from './obsolete-fields';
import { useAttributePanel } from './use-attribute-panel';
interface AttributePanelProps extends EventFocusProps {
  onEditEvent: (target: EventTarget) => void;
}
export const AttributePanel = ({
  onEditEvent,
  focusTarget,
  onFocusRestored,
}: AttributePanelProps): React.JSX.Element => {
  const {
    activeElement,
    schema,
    material,
    values,
    obsoleteFields,
    hiddenBindings,
    panels,
    parents,
    activePanel,
    setActivePanel,
    setActiveElement,
    update,
    removeObsoleteFields,
  } = useAttributePanel(focusTarget);
  return (
    <aside
      className='flex h-full w-70 shrink-0 flex-col border-l border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950'
      aria-label='属性面板'
    >
      {!activeElement ? (
        <div className='grid size-full place-items-center p-5 text-center text-sm text-zinc-600 dark:text-zinc-400'>
          请从左侧画布选中元素
        </div>
      ) : (
        <>
          <div className='flex h-10 shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400'>
            {parents.map((parent) => (
              <button
                key={parent.id}
                type='button'
                className='flex shrink-0 items-center hover:text-blue-600 dark:hover:text-blue-400'
                onClick={() => setActiveElement(parent)}
              >
                <span
                  className='max-w-24 truncate'
                  title={getElementLabel(
                    parent.id,
                    schema.elements[parent.id],
                    String(parent.material.title),
                  )}
                >
                  {getElementLabel(
                    parent.id,
                    schema.elements[parent.id],
                    String(parent.material.title),
                  )}
                </span>
                <ChevronRight size={12} className='mx-1' />
              </button>
            ))}
            <span
              className='shrink-0'
              title={getElementLabel(
                activeElement.id,
                schema.elements[activeElement.id],
                String(activeElement.material.title),
              )}
            >
              {getElementLabel(
                activeElement.id,
                schema.elements[activeElement.id],
                String(activeElement.material.title),
              )}
            </span>
          </div>
          <ObsoleteFields fields={obsoleteFields} onRemove={removeObsoleteFields} />
          {panels.length === 0 ? (
            <p className='p-4 text-xs text-zinc-500'>此物料没有可编辑属性。</p>
          ) : (
            <div className='flex min-h-0 flex-1 flex-col'>
              <div
                className='flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-zinc-200 px-2 dark:border-zinc-800'
                role='tablist'
                aria-label='属性分类'
              >
                {panels.map((panel, index) => (
                  <button
                    key={`${String(panel.title)}-${index}`}
                    type='button'
                    role='tab'
                    aria-selected={
                      activePanel === (panel.kind === 'events' ? 'events' : String(index))
                    }
                    className={`h-full shrink-0 border-b-2 px-2 text-xs font-medium ${activePanel === (panel.kind === 'events' ? 'events' : String(index)) ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                    onClick={() =>
                      setActivePanel(panel.kind === 'events' ? 'events' : String(index))
                    }
                  >
                    {panel.title}
                  </button>
                ))}
              </div>
              <div className='min-h-0 flex-1 overflow-auto p-3'>
                {panels.map((panel, index) => {
                  if (activePanel !== (panel.kind === 'events' ? 'events' : String(index)))
                    return null;
                  if (panel.kind === 'events') {
                    return (
                      <EventFields
                        key='events'
                        elementId={activeElement.id}
                        events={panel.events}
                        hiddenBindings={hiddenBindings}
                        focusTarget={focusTarget}
                        onFocusRestored={onFocusRestored}
                        onEditEvent={onEditEvent}
                      />
                    );
                  }
                  return (
                    <div key={`${String(panel.title)}-${index}`} className='space-y-3'>
                      {(panel.configs ?? []).map((config) => (
                        <AttributeField
                          key={config.field}
                          config={config}
                          elementId={activeElement.id}
                          material={material}
                          values={values}
                          schema={schema}
                          update={update}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
};
