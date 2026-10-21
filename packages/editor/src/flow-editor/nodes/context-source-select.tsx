import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@origamix/ui';
import { X } from 'lucide-react';

export interface ContextSourceOption {
  value: string;
  label: string;
  property: string;
  name: string;
  tags: string[];
}

const SourceTags = ({ option }: { option: ContextSourceOption }): React.JSX.Element => (
  <span className='flex min-w-0 flex-wrap items-center gap-1 text-left'>
    <span className='min-w-0 text-xs leading-5 break-words text-foreground'>{option.property}</span>
    {option.tags.map((tag, index) => (
      <span
        key={index}
        className={`max-w-full rounded-md border px-1.5 py-0.5 text-[11px] leading-4 break-all ${['border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300', 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300', 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'][index % 3]}`}
      >
        {tag}
      </span>
    ))}
  </span>
);

export const ContextSourceSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ContextSourceOption[];
  onChange: (value: string) => void;
}): React.JSX.Element => {
  const selected = options.find((option) => option.value === value);
  return (
    <div className='relative min-w-0'>
      <Select
        items={options}
        value={value || null}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        <SelectTrigger
          aria-label={label}
          className='h-auto! min-h-9 w-full min-w-0 pr-10 whitespace-normal [&_[data-slot=select-value]]:line-clamp-none'
        >
          <SelectValue>
            {selected ? <SourceTags option={selected} /> : value || '请选择属性'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className='max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain'
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className='py-2 [&>span]:min-w-0 [&>span]:whitespace-normal'
            >
              <SourceTags option={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && (
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label={`清除${label}`}
          className='absolute top-1/2 right-6 size-6 -translate-y-1/2 text-muted-foreground'
          onClick={() => onChange('')}
        >
          <X size={12} />
        </Button>
      )}
    </div>
  );
};
