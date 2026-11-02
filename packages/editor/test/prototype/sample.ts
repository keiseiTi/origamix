import { ORIGAMIX_VERSION } from '@origamix/shared';
import type { OrigamixPageSchema } from '@origamix/shared';
export const sample: OrigamixPageSchema = {
  elements: {
    root: { type: 'container', props: { heightConfig: 'auto', padding: 24 } },
    form: { type: 'form', props: { layout: 'vertical' } },
    input: {
      type: 'input',
      props: {
        placeholder: '页面保持浅色，输入提示可由宿主修改',
        fieldName: 'name',
        fieldLabel: '姓名',
      },
    },
    button: { type: 'button', props: { text: '选中这个按钮', type: 'primary' } },
    nested: { type: 'container', props: { heightConfig: 'fixed', height: 720, padding: 24 } },
    nestedButton: { type: 'button', props: { text: '嵌套容器中的按钮' } },
  },
  layout: {
    root: 'root',
    structure: {
      root: ['form', 'button', 'nested'],
      form: ['input'],
      input: [],
      button: [],
      nested: ['nestedButton'],
      nestedButton: [],
    },
  },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
};
