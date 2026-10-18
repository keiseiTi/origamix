import { lazy } from 'react';
import { defineMaterial } from '@';
import { treeManifest } from './manifest';
import { validateKeys, validateTreeNodes } from '../structured-data-validation';

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
            validateValue: validateTreeNodes,
            label: '树节点',
            uiType: 'json',
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
            validateValue: validateKeys,
            label: '默认展开节点键',
            uiType: 'json',
            linkageShow: [
              {
                field: 'defaultExpandAll',
                value: false,
              },
            ],
          },
          {
            field: 'defaultSelectedKeys',
            validateValue: validateKeys,
            label: '默认选中节点键',
            uiType: 'json',
            linkageShow: [
              {
                field: 'selectable',
                value: true,
              },
            ],
          },
          {
            field: 'defaultCheckedKeys',
            validateValue: validateKeys,
            label: '默认勾选节点键',
            uiType: 'json',
            linkageShow: [
              {
                field: 'checkable',
                value: true,
              },
            ],
          },
          {
            field: 'showLine',
            label: '显示连接线',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'showIcon',
            label: '显示节点图标',
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
            field: 'draggable',
            label: '允许拖动',
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
