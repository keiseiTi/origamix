import type { PanelConfig } from '../../src/material';
// import { RuleConfig } from '@/components/rule-config';

export const formConfigPanel: PanelConfig = {
  title: '表单项',
  configs: [
    { label: '表单字段', field: 'name', uiType: 'input', required: true },
    { label: '表单标签', field: 'label', uiType: 'input' },
    { label: '提示信息', field: 'tooltip', uiType: 'input' },
    { label: '是否必填', field: 'required', uiType: 'checkbox' },
    // { label: '校验规则', field: 'rules', uiType: 'custom', render: RuleConfig },
  ],
};
