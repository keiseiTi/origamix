import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { textManifest } from './manifest';

const material = toEditorMaterial(
  fromMaterialManifest(textManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '内容',
              field: 'text',
              uiType: 'input',
            },
            {
              label: '类型',
              field: 'type',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '文本',
                    value: 'text',
                  },
                  {
                    label: '段落',
                    value: 'paragraph',
                  },
                  {
                    label: '标题 H1',
                    value: 'h1',
                  },
                  {
                    label: '标题 H2',
                    value: 'h2',
                  },
                  {
                    label: '标题 H3',
                    value: 'h3',
                  },
                  {
                    label: '标题 H4',
                    value: 'h4',
                  },
                  {
                    label: '标题 H5',
                    value: 'h5',
                  },
                ],
              },
            },
            {
              label: '文本颜色',
              field: 'textType',
              uiType: 'select',
              props: {
                options: [
                  {
                    label: '默认',
                    value: undefined,
                  },
                  {
                    label: '次级',
                    value: 'secondary',
                  },
                  {
                    label: '成功',
                    value: 'success',
                  },
                  {
                    label: '警告',
                    value: 'warning',
                  },
                  {
                    label: '危险',
                    value: 'danger',
                  },
                ],
              },
            },
            {
              label: '加粗',
              field: 'strong',
              uiType: 'checkbox',
            },
            {
              label: '斜体',
              field: 'italic',
              uiType: 'checkbox',
            },
            {
              label: '下划线',
              field: 'underline',
              uiType: 'checkbox',
            },
            {
              label: '删除线',
              field: 'delete',
              uiType: 'checkbox',
            },
            {
              label: '代码样式',
              field: 'code',
              uiType: 'checkbox',
            },
            {
              label: '标记样式',
              field: 'mark',
              uiType: 'checkbox',
            },
            {
              label: '禁用样式',
              field: 'disabled',
              uiType: 'checkbox',
            },
            {
              label: '可复制',
              field: 'copyable',
              uiType: 'checkbox',
            },
            {
              label: '超出省略',
              field: 'ellipsis',
              uiType: 'checkbox',
            },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default material;
