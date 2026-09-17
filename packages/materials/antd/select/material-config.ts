// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { selectManifest } from './manifest';

const SelectMaterial = toEditorMaterial(
  fromMaterialManifest(selectManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '模式',
              field: 'mode',
              uiType: 'select',
              props: {
                allowClear: true,
                options: [
                  { label: '多选', value: 'multiple' },
                  { label: '标签', value: 'tags' },
                ],
              },
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
              label: '允许清除',
              field: 'allowClear',
              uiType: 'checkbox',
            },
            // {
            //   field: 'options',
            //   uiType: 'custom',
            //   render: OptionsConfig,
            // },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default SelectMaterial;
