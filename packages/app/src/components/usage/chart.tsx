// Adapted from the shadcn/ui Base Nova chart registry.
import {
  createContext,
  useContext,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts';

export type ChartConfig = Record<string, { label: ReactNode; color: string }>;

const ChartContext = createContext<ChartConfig>({});

export const ChartContainer = ({
  config,
  children,
}: {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
}): React.JSX.Element => {
  const colors = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]),
  ) as CSSProperties;
  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot='chart'
        className='flex h-52 w-full min-w-0 justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden'
        style={colors}
      >
        <ResponsiveContainer initialDimension={{ width: 320, height: 208 }}>
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
};

export const ChartTooltip = Tooltip;

export const ChartTooltipContent = ({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<TooltipValueType, string | number>>): React.JSX.Element | null => {
  const config = useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return (
    <div className='grid min-w-32 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-lg'>
      <div className='font-medium'>{label}</div>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name);
        return (
          <div key={key} className='flex items-center gap-2'>
            <span className='size-2.5 rounded-xs' style={{ backgroundColor: config[key]?.color }} />
            <span className='text-muted-foreground'>{config[key]?.label ?? item.name}</span>
            <span className='ml-auto font-mono font-medium tabular-nums'>
              {item.value?.toLocaleString('zh-CN')}
            </span>
          </div>
        );
      })}
    </div>
  );
};
