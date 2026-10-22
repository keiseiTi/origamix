import { TreeDataEditor, KeysEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { treeManifest } from './manifest';
const material = defineMaterial({
  manifest: treeManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'treeData',
            label: '树节点',
            uiType: 'custom',
            render: TreeDataEditor,
          },
          {
            field: 'checkable',
            label: '显示复选框',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'checkStrictly',
            label: '父子勾选独立',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'checkable',
                value: true,
              },
            ],
          },
          {
            field: 'multiple',
            label: '允许多选',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'selectable',
            label: '允许选中',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'disabled',
            label: '禁用',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'defaultExpandAll',
            label: '默认展开全部',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'defaultExpandParent',
            label: '默认展开父节点',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'autoExpandParent',
            label: '自动展开父节点',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'defaultExpandedKeys',
            label: '默认展开节点键',
            linkageShow: [
              {
                field: 'defaultExpandAll',
                value: false,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            field: 'defaultSelectedKeys',
            label: '默认选中节点键',
            linkageShow: [
              {
                field: 'selectable',
                value: true,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            field: 'defaultCheckedKeys',
            label: '默认勾选节点键',
            linkageShow: [
              {
                field: 'checkable',
                value: true,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            field: 'showLine',
            label: '显示连接线',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'blockNode',
            label: '节点占满一行',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'virtual',
            label: '虚拟滚动',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'height',
            label: '滚动区域高度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
        ],
      },
    ],
  },
});
export default material;
