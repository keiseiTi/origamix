import { Button, FieldLabel, Input } from '@origamix/ui';
import { Choice } from './choice';
import { useLiveProperty } from './use-live-property';
import type { CollectionEditorProps } from './collection-editor';

type Rule = { type: string; value?: string | number; message?: string };
const RuleEditor = ({ value, onChange }: CollectionEditorProps) => {
  const {
    draft: rules,
    change,
    error,
  } = useLiveProperty<Rule[]>(
    value,
    (value) => (Array.isArray(value) ? value : []),
    (rules) => {
      for (const rule of rules) {
        if (rule.type === 'pattern') {
          try {
            if (!rule.value) return '请填写正则表达式。';
            new RegExp(String(rule.value));
          } catch {
            return '正则表达式无效。';
          }
        } else if (
          !['email', 'url'].includes(rule.type) &&
          (typeof rule.value !== 'number' ||
            !Number.isFinite(rule.value) ||
            (rule.type.endsWith('Length') && (!Number.isInteger(rule.value) || rule.value < 0)))
        )
          return '请填写有效的范围或长度。';
      }
      return undefined;
    },
    onChange,
  );
  const update = (index: number, patch: Partial<Rule>) =>
    change(
      rules.map((rule, i) => {
        if (i !== index) return rule;
        const next = { ...rule, ...patch };
        if (['email', 'url'].includes(next.type)) delete next.value;
        return next;
      }),
    );
  return (
    <div className='space-y-2'>
      {!rules.length && <p className='text-xs text-muted-foreground'>暂无校验规则</p>}
      {rules.map((rule, index) => (
        <fieldset key={index} className='space-y-2 rounded border border-border p-2'>
          <legend className='text-xs'>规则 {index + 1}</legend>
          <Choice
            label={`规则 ${index + 1} 类型`}
            value={rule.type}
            options={[
              { value: 'minLength', label: '最小长度' },
              { value: 'maxLength', label: '最大长度' },
              { value: 'min', label: '最小值' },
              { value: 'max', label: '最大值' },
              { value: 'email', label: '邮箱' },
              { value: 'url', label: '网址' },
              { value: 'pattern', label: '正则表达式' },
            ]}
            onChange={(type) =>
              update(index, { type: String(type), value: type === 'pattern' ? '' : 0 })
            }
          />
          {!['email', 'url'].includes(rule.type) && (
            <FieldLabel>
              校验值
              <Input
                aria-label={`规则 ${index + 1} 校验值`}
                type={rule.type === 'pattern' ? 'text' : 'number'}
                value={String(rule.value ?? '')}
                onChange={(event) =>
                  update(index, {
                    value:
                      rule.type === 'pattern'
                        ? event.target.value
                        : event.target.value === ''
                          ? NaN
                          : Number(event.target.value),
                  })
                }
              />
            </FieldLabel>
          )}
          <FieldLabel>
            错误提示
            <Input
              aria-label={`规则 ${index + 1} 错误提示`}
              value={rule.message ?? ''}
              onChange={(event) => update(index, { message: event.target.value })}
            />
          </FieldLabel>
          <Button
            size='sm'
            variant='outline'
            onClick={() => change(rules.filter((_, i) => i !== index))}
          >
            删除规则
          </Button>
        </fieldset>
      ))}
      <Button
        size='sm'
        variant='outline'
        onClick={() => change([...rules, { type: 'minLength', value: 1 }])}
      >
        添加规则
      </Button>
      {error && (
        <p role='alert' className='text-xs text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
};

export default RuleEditor;
