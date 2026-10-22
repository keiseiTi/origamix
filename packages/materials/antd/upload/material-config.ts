import { lazy } from 'react';
import { defineMaterial } from '@';
import { uploadManifest } from './manifest';
const material = defineMaterial({
  manifest: uploadManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '上传文案',
            field: 'text',
            uiType: 'input',
          },
          {
            label: '列表样式',
            field: 'listType',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '图片',
                  value: 'picture',
                },
                {
                  label: '图片卡片',
                  value: 'picture-card',
                },
                {
                  label: '圆形图片',
                  value: 'picture-circle',
                },
              ],
            },
          },
          {
            label: '最大数量',
            field: 'maxCount',
            uiType: 'number',
            props: {
              min: 1,
              step: 1,
            },
          },
          {
            label: '多选文件',
            field: 'multiple',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '拖拽上传',
            field: 'drag',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '展示文件列表',
            field: 'showUploadList',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            label: '接受文件类型',
            field: 'accept',
            uiType: 'input',
          },
          {
            label: '上传地址',
            field: 'action',
            uiType: 'input',
          },
          {
            label: '请求方式',
            field: 'method',
            uiType: 'select',
            props: {
              options: [
                {
                  label: 'POST',
                  value: 'post',
                },
                {
                  label: 'PUT',
                  value: 'put',
                },
              ],
            },
          },
          {
            label: '文件字段名',
            field: 'name',
            uiType: 'input',
          },
          {
            label: '上传整个目录',
            field: 'directory',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '点击选择文件',
            field: 'openFileDialogOnClick',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            label: '粘贴文件',
            field: 'pastable',
            uiType: 'checkbox',
            defaultValue: false,
          },
        ],
      },
    ],
  },
});
export default material;
