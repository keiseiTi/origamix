import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@origamix/ui/select';

export const FlowSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}): React.JSX.Element => (
  <Select
    items={options}
    value={value || null}
    onValueChange={(next) => {
      if (next) onChange(next);
    }}
  >
    <SelectTrigger aria-label={label} className='w-full'>
      <SelectValue placeholder={`选择${label}`} />
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
