import { Popover } from '@base-ui/react/popover';
import { cn } from '../lib/utils';

// Use Popover's hover trigger so cards with actions also support click and keyboard navigation.
export const HoverCard = (props: Popover.Root.Props) => <Popover.Root {...props} />;

export const HoverCardTrigger = (props: Popover.Trigger.Props) => (
  <Popover.Trigger openOnHover data-slot='hover-card-trigger' {...props} />
);

export const HoverCardContent = ({
  className,
  side = 'top',
  sideOffset = 8,
  ...props
}: Popover.Popup.Props & Pick<Popover.Positioner.Props, 'side' | 'sideOffset'>) => (
  <Popover.Portal>
    <Popover.Positioner side={side} sideOffset={sideOffset} className='isolate z-1100'>
      <Popover.Popup
        data-slot='hover-card-content'
        className={cn(
          'max-w-[calc(100vw-1.5rem)] rounded-lg border bg-popover p-3 text-left text-sm text-popover-foreground shadow-lg',
          className,
        )}
        {...props}
      />
    </Popover.Positioner>
  </Popover.Portal>
);
