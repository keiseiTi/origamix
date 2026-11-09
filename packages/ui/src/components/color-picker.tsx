import type { CSSProperties } from 'react';
import { Popover } from '@base-ui/react/popover';
import Chrome, { ChromeInputType } from '@uiw/react-color-chrome';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Input } from './input';

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

export const ColorPicker = ({
  value = '',
  onChange,
  'aria-label': label = '颜色',
  disabled = false,
  className,
}: ColorPickerProps) => (
  <Popover.Root>
    <Popover.Trigger
      disabled={disabled}
      aria-label={`${label}：${value || '未设置'}`}
      render={<Button variant='outline' className={cn('w-full justify-start', className)} />}
    >
      <span
        aria-hidden='true'
        className='size-4 shrink-0 rounded-sm border border-border'
        style={{ backgroundColor: value || 'transparent' }}
      />
      <span className='truncate font-mono text-xs'>{value || '未设置'}</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={6} align='end' className='z-50'>
        <Popover.Popup className='w-60 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none [&_input]:focus-visible:outline-2 [&_input]:focus-visible:outline-ring'>
          <div className='flex items-center justify-between px-3 pt-2'>
            <Popover.Title className='text-xs font-medium'>{label}</Popover.Title>
          </div>
          <Chrome
            color={/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ? value : '#000000'}
            inputType={ChromeInputType.HEXA}
            showEditableInput={true}
            showEyeDropper={false}
            showAlpha={true}
            onChange={(color) => onChange(color.rgba.a < 1 ? color.hexa : color.hex)}
            style={
              {
                width: '100%',
                marginTop: 8,
                border: 0,
                boxShadow: 'none',
                '--github-background-color': 'var(--popover)',
                '--github-arrow-border-color': 'transparent',
              } as CSSProperties
            }
          />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

export type { ColorPickerProps };
