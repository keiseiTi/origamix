import { useFlowEditorSession } from '../session';
import { FieldLabel, Input } from '@origamix/ui';

import { JsonAttributeField } from '../../components/json-attribute-field';
import { FlowSelect } from '../flow-select';

import { asRecord } from './values';

export const ValueField = ({
  label,
  value,
  onChange,
  objectOnly = false,
  literalType,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  objectOnly?: boolean;
  literalType?: 'string' | 'boolean' | 'stringRecord';
}): React.JSX.Element => {
  const { schema } = useFlowEditorSession();
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
            next === 'literal'
              ? objectOnly
                ? {}
                : literalType === 'string'
                  ? ''
                  : literalType === 'boolean'
                    ? true
                    : null
              : { $ref: next, name: '', path: '' },
          )
        }
      />
      {source === 'literal' && literalType === 'string' ? (
        <Input
          aria-label={label}
          value={typeof value === 'string' ? value : ''}
          placeholder='https://api.example.com/data'
          onChange={(event) => onChange(event.target.value)}
        />
      ) : source === 'literal' ? (
        <JsonAttributeField
          key={JSON.stringify(value)}
          label={label}
          value={value ?? (objectOnly ? {} : null)}
          validateValue={(candidate) => {
            if (
              objectOnly &&
              (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate))
            )
              return '请输入 JSON 对象';
            if (
              literalType === 'stringRecord' &&
              Object.values(asRecord(candidate)).some((item) => typeof item !== 'string')
            )
              return '请求头各项值必须为字符串';
            if (
              (literalType === 'string' || literalType === 'boolean') &&
              typeof candidate !== literalType
            )
              return literalType === 'string' ? '请输入 JSON 字符串' : '请输入 true 或 false';
            return undefined;
          }}
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
