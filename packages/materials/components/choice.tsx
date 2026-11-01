import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@origamix/ui';
export const Choice = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) => (
  <Select
    items={options}
    value={value}
    onValueChange={(next: string | null) => {
      if (next !== null) onChange(next);
    }}
  >
    <SelectTrigger aria-label={label} className='w-full'>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
