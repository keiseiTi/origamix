import React from 'react';

const Switch = React.lazy(() => import('./index'));
import type { Material } from '../../src/material';
import { switchManifest } from '../manifest';

const SwitchMaterial: Material = {
  Component: Switch,
  title: switchManifest.title,
  type: switchManifest.type,
  dropTypes: ['form'],
  contextConfig: {
    variables: [...switchManifest.context.variables],
    methods: switchManifest.context.methods.map((method) => ({
      ...method,
      params: method.params?.map((param) => ({ description: param.description ?? '' })),
    })),
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '初始是否选中',
            field: 'defaultChecked',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default SwitchMaterial;
