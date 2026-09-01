import React, { useEffect, useState } from 'react';
import { InputNumber, Select } from 'antd';

interface IProps {
  value?:
    | boolean
    | {
        minRows: number | null;
        maxRows: number | null;
      };
  onChange?: (value?: IProps['value']) => void;
}

export const AutoSize = (props: IProps) => {
  const { value, onChange } = props;
  const [autoSize, setAutoSize] = useState<'auto' | 'fix'>();
  const [maxRows, setMaxRows] = useState<number | null>(null);
  const [minRows, setMinRows] = useState<number | null>(null);

  useEffect(() => {
    if (typeof value === 'boolean') {
      setAutoSize('auto');
    }
    if (typeof value === 'object' && value != null) {
      setAutoSize('fix');
      setMaxRows(value?.maxRows);
      setMinRows(value?.minRows);
    }
  }, []);

  const onChangeMode = (mode?: 'auto' | 'fix') => {
    setAutoSize(mode);
    if (mode === 'auto') {
      onChange?.(true);
    }
    if (!mode) {
      onChange?.({
        minRows,
        maxRows,
      });
    }
  };

  const onChangeRows = (type: 'max' | 'min', v: number | null) => {
    if (type === 'max') {
      setMaxRows(v);
      onChange?.({
        maxRows: v,
        minRows,
      });
    }
    if (type === 'min') {
      setMinRows(v);
      onChange?.({
        maxRows,
        minRows: v,
      });
    }
  };

  return (
    <>
      <div className='text-xs mb-2'>自适应内容高度</div>
      <Select
        allowClear
        value={autoSize}
        onChange={onChangeMode}
        options={[
          {
            label: '自适应',
            value: 'auto',
          },
          {
            label: '展示最大最小行数',
            value: 'fix',
          },
        ]}
      />
      {autoSize === 'fix' && (
        <>
          <div className='text-xs mb-2'>
            <span>展示最小行数：</span>
            <InputNumber
              style={{ width: '100%' }}
              value={minRows}
              onChange={onChangeRows.bind(this, 'min')}
            />
          </div>
          <div className='text-xs my-2'>
            <span>展示最大行数：</span>
            <InputNumber
              style={{ width: '100%' }}
              value={maxRows}
              onChange={onChangeRows.bind(this, 'max')}
            />
          </div>
        </>
      )}
    </>
  );
};
