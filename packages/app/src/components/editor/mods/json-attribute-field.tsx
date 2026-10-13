import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  label: string;
  value: unknown;
  validateValue: (value: unknown) => string | undefined;
  onChange: (value: unknown) => void;
}

/** Text stays local until explicitly accepted, so partially typed JSON never reaches the canvas. */
export const JsonAttributeField = ({
  label,
  value,
  validateValue,
  onChange,
}: Props): React.JSX.Element => {
  const [text, setText] = useState(() => JSON.stringify(value ?? [], null, 2));
  const [error, setError] = useState<string>();
  const errorId = useId();
  const apply = (): void => {
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      setError('数据格式有误，请检查引号、逗号和括号后重试。');
      return;
    }
    const issue = validateValue(candidate);
    if (issue) {
      setError(issue);
      return;
    }
    setError(undefined);
    onChange(candidate);
  };
  return (
    <div className='space-y-2'>
      <Textarea
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className='min-h-32 font-mono text-xs'
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
      />
      {error && (
        <p id={errorId} role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
      <Button size='sm' variant='outline' onClick={apply}>
        更新{label}
      </Button>
      <p className='text-xs text-muted-foreground'>确认格式后点击更新，再保存版本。</p>
    </div>
  );
};
