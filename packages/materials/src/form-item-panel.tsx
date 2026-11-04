import { lazy, Suspense } from 'react';
import { formRuleSchema } from './form-field-schema';
import type { PanelConfig } from './material';
import type { CollectionEditorProps } from '../components/collection-editor';
const RuleEditor = lazy(() => import('../components/form-rules-editor'));
const FormRulesControl = (props: CollectionEditorProps) => (
  <Suspense fallback={<span className='text-xs'>正在加载校验规则…</span>}>
    <RuleEditor {...props} />
  </Suspense>
);
export const formItemPanel: PanelConfig = {
  title: '表单项',
  id: 'antd.form.item',
  configs: [
    { field: 'fieldName', label: '表单字段', uiType: 'input' },
    { field: 'fieldLabel', label: '表单标签', uiType: 'input' },
    { field: 'fieldTooltip', label: '提示信息', uiType: 'input' },
    { field: 'fieldRequired', label: '是否必填', uiType: 'checkbox' },
    {
      field: 'fieldRules',
      label: '校验规则',
      uiType: 'custom',
      schema: formRuleSchema,
      render: FormRulesControl,
      resetOnValueChange: false,
    },
  ],
};
