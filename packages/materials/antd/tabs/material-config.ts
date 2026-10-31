import { TabItemsEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'tabs',
  layout: { display: 'block' },
  title: '标签选项卡',
  defaultProps: {
    type: 'line',
    items: [
      { key: '1', label: '标签一', children: '标签一内容' },
      { key: '2', label: '标签二', children: '标签二内容' },
    ],
    hideAdd: true,
  },
  context: {
    variables: [{ name: 'activeKey', description: '激活页签' }],
    writable: [
      { name: 'activeKey', description: '激活页签' },
      { name: 'items', description: '页签' },
    ],
    actions: [],
    events: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'onEdit',
        description: '编辑页签',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'type', value: 'editable-card' }],
      },
    ],
  },
  description: '标签选项卡的结构与展示属性。',
  keywords: ['标签选项卡', 'layout'],
  role: 'layout',
  acceptsChildren: true,
  allowedParentTypes: ['basicPage', 'container', 'modal', 'drawer'],
  usage: '页签项保存纯文本；Schema 子元素显示在第一个页签中。',
  constraints: ['页签 key 应唯一。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  key: { type: 'string', minLength: 1 },
                  label: { type: 'string' },
                  children: { type: 'string' },
                  disabled: { type: 'boolean' },
                  closable: { type: 'boolean' },
                  forceRender: { type: 'boolean' },
                  destroyOnHidden: { type: 'boolean' },
                },
                required: ['key', 'label'],
              },
            },
            field: 'items',
            label: '页签项',
            uiType: 'custom',
            render: TabItemsEditor,
          },
          {
            field: 'defaultActiveKey',
            label: '默认激活键',
            uiType: 'input',
          },
          {
            field: 'type',
            label: '类型',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '线条',
                  value: 'line',
                },
                {
                  label: '卡片',
                  value: 'card',
                },
                {
                  label: '可编辑卡片',
                  value: 'editable-card',
                },
              ],
            },
          },
          {
            field: 'size',
            label: '尺寸',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '大',
                  value: 'large',
                },
                {
                  label: '中',
                  value: 'medium',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
          {
            field: 'tabPlacement',
            label: '位置',
            uiType: 'select',
            defaultValue: 'top',
            props: {
              options: [
                {
                  label: '顶部',
                  value: 'top',
                },
                {
                  label: '右侧',
                  value: 'end',
                },
                {
                  label: '底部',
                  value: 'bottom',
                },
                {
                  label: '左侧',
                  value: 'start',
                },
              ],
            },
          },
          {
            field: 'tabBarGutter',
            label: '页签间距',
            uiType: 'number',
            props: {
              min: 0,
            },
          },
          {
            field: 'centered',
            label: '居中',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'animated',
            label: '切换动画',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'destroyOnHidden',
            label: '销毁隐藏面板',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'hideAdd',
            label: '隐藏新增按钮',
            uiType: 'checkbox',
            linkageShow: [
              {
                field: 'type',
                value: 'editable-card',
              },
            ],
          },
          { field: 'activeKey', hidden: true, schema: { type: 'string' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default material;
