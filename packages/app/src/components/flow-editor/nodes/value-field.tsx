import { useEditorCore } from '@tangramino/base-editor';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { JsonAttributeField } from '../../editor/mods/json-attribute-field';
import { FlowSelect } from '../flow-select';

import { asRecord } from './values';

export const ValueField = ({
  label,
  value,
  onChange,
  objectOnly = false,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  objectOnly?: boolean;
}): React.JSX.Element => {
  const schema = useEditorCore((state) => state.schema);
  const record = asRecord(value);
  const source = record.$ref === 'global' || record.$ref === 'result' ? record.$ref : 'literal';
  return (
    <div className='space-y-2'>
      <FieldLabel>{label}</FieldLabel>
      <FlowSelect
        label={`${label}来源`}
        value={source}
        options={[
          { value: 'literal', label: 'JSON 值' },
          { value: 'global', label: '全局变量' },
          { value: 'result', label: '节点返回值' },
        ]}
        onChange={(next) =>
          onChange(
            next === 'literal' ? (objectOnly ? {} : null) : { $ref: next, name: '', path: '' },
          )
        }
      />
      {source === 'literal' ? (
        <JsonAttributeField
          key={JSON.stringify(value)}
          label={label}
          value={value ?? (objectOnly ? {} : null)}
          validateValue={(candidate) =>
            objectOnly &&
            (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate))
              ? '请输入 JSON 对象'
              : undefined
          }
          onChange={onChange}
        />
      ) : (
        <>
          {source === 'global' ? (
            <FlowSelect
              label={`${label}全局变量`}
              value={String(record.name ?? '')}
              options={(schema.context?.globalVariables ?? []).map((variable) => ({
                value: variable.name,
                label: variable.name,
              }))}
              onChange={(name) => onChange({ ...record, name })}
            />
          ) : (
            <Input
              aria-label={`${label}节点 ID`}
              value={String(record.name ?? '')}
              placeholder='来源节点 ID'
              onChange={(event) => onChange({ ...record, name: event.target.value })}
            />
          )}
          <Input
            aria-label={`${label}数据路径`}
            value={String(record.path ?? '')}
            placeholder='可选数据路径，如 data.id'
            onChange={(event) => onChange({ ...record, path: event.target.value })}
          />
        </>
      )}
    </div>
  );
};
