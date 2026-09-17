import React from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { treeManifest } from './manifest';

const Tree = React.lazy(() => import('./index'));

const TreeMaterial = toEditorMaterial(
  fromMaterialManifest(treeManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '可选中',
              field: 'checkable',
              uiType: 'checkbox',
            },
            {
              label: '多选',
              field: 'multiple',
              uiType: 'checkbox',
            },
            {
              label: '默认展开所有',
              field: 'defaultExpandAll',
              uiType: 'checkbox',
            },
            {
              label: '严格选中',
              field: 'checkStrictly',
              uiType: 'checkbox',
            },
            {
              label: '显示线',
              field: 'showLine',
              uiType: 'checkbox',
            },
            {
              label: '可拖拽',
              field: 'draggable',
              uiType: 'checkbox',
            },
          ],
        },
      ],
    },
  }),
  Tree,
);

export default TreeMaterial;
