import React from 'react';
import { AutoSize } from './mods/auto-size';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { textareaManifest } from './manifest';

const Textarea = React.lazy(() => import('./index'));

const TextareaMaterial = toEditorMaterial(
  fromMaterialManifest(textareaManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '最大长度',
              field: 'maxLength',
              uiType: 'number',
              props: {
                min: 0,
                step: 1,
              },
            },
            {
              label: '显示字数统计',
              field: 'showCount',
              uiType: 'checkbox',
            },
            {
              label: '占位符',
              field: 'placeholder',
              uiType: 'input',
              props: {
                placeholder: '请输入占位符文本',
              },
            },
            {
              field: 'autoSize',
              uiType: 'custom',
              render: AutoSize,
            },
          ],
        },
      ],
    },
  }),
  Textarea,
);

export default TextareaMaterial;
