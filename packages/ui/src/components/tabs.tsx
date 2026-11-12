// 'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '../lib/utils';

const Tabs = ({ className, ...props }: TabsPrimitive.Root.Props) => (
  <TabsPrimitive.Root
    data-slot='tabs'
    className={cn('flex flex-col gap-2', className)}
    {...props}
  />
);

const TabsList = ({ className, ...props }: TabsPrimitive.List.Props) => (
  <TabsPrimitive.List
    data-slot='tabs-list'
    className={cn('flex h-9 shrink-0 items-center gap-1 rounded-lg bg-muted p-1', className)}
    {...props}
  />
);

const TabsTrigger = ({ className, ...props }: TabsPrimitive.Tab.Props) => (
  <TabsPrimitive.Tab
    data-slot='tabs-trigger'
    className={cn(
      'inline-flex h-full flex-1 items-center justify-center rounded-md px-2 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-active:bg-background data-active:text-foreground data-active:shadow-xs',
      className,
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel
    data-slot='tabs-content'
    className={cn(
      'min-h-0 min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
