import { Button } from '@origamix/ui';
const modes = [
  { value: 'side', label: '左侧菜单' },
  { value: 'top', label: '顶部菜单' },
  { value: 'mix', label: '混合菜单' },
] as const;
const ModePicker = ({
  value,
  onChange,
}: {
  value?: unknown;
  onChange?: (value: unknown) => void;
}) => (
  <div className='grid grid-cols-3 gap-2' role='group' aria-label='导航布局'>
    {modes.map((mode) => (
      <Button
        key={mode.value}
        variant={value === mode.value ? 'secondary' : 'outline'}
        aria-pressed={value === mode.value}
        onClick={() => onChange?.(mode.value)}
        className={`h-auto min-w-0 flex-col gap-2 px-1 py-2 text-xs ${value === mode.value ? 'ring-2 ring-primary' : ''}`}
      >
        <span
          aria-hidden='true'
          className='relative block h-10 w-12 overflow-hidden rounded border border-current/30 bg-current/5'
        >
          <span
            className={`absolute top-0 right-0 h-2 bg-current/40 ${mode.value === 'side' ? 'left-3' : 'left-0'}`}
          />
          {mode.value !== 'top' && (
            <span
              className={`absolute bottom-0 left-0 w-3 bg-current/30 ${mode.value === 'side' ? 'top-0' : 'top-2'}`}
            />
          )}
        </span>
        {mode.label}
      </Button>
    ))}
  </div>
);
export default ModePicker;
