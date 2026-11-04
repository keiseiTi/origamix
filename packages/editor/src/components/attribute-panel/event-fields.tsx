import { Button } from '@origamix/ui';
import type { Material } from '../../interfaces/material-interfaces';
import type { EventFocusProps } from '../editor-layout/event-focus-target';
import type { EventTarget } from '../flow-editor/flow-graph';
type MaterialEvent = NonNullable<NonNullable<Material['contextConfig']>['events']>[number];
interface EventFieldsProps extends EventFocusProps {
  elementId: string;
  events: MaterialEvent[];
  hiddenBindings: MaterialEvent[] | undefined;
  onEditEvent: (target: EventTarget) => void;
}
export const EventFields = ({
  elementId,
  events,
  hiddenBindings,
  focusTarget,
  onFocusRestored,
  onEditEvent,
}: EventFieldsProps): React.JSX.Element => (
  <div key='events'>
    {!!hiddenBindings?.length && (
      <p role='status' className='mb-2 text-xs text-muted-foreground'>
        当前模式不支持的已有事件绑定：
        {hiddenBindings.map((event) => event.description || event.name).join('、')}
        。绑定已保留，请调整模式或在逻辑视图处理。
      </p>
    )}
    {events.map((event) => (
      <Button
        variant='outline'
        key={event.name}
        ref={(button) => {
          if (
            button &&
            focusTarget?.elementId === elementId &&
            focusTarget.eventName === event.name
          ) {
            button.focus();
            onFocusRestored();
          }
        }}
        className='mb-2 w-full justify-start text-xs'
        onClick={() =>
          onEditEvent({
            elementId: elementId,
            event: event.name,
            label: event.description || event.name,
          })
        }
      >
        <span>{event.description || event.name}</span>
      </Button>
    ))}
  </div>
);
