import { defineManifest } from '../manifest-definition';

export const uploadManifest = defineManifest({
  type: 'upload',
  title: '上传',
  defaultProps: {
    text: '选择文件',
    showUploadList: true,
    openFileDialogOnClick: true,
  },
  context: {
    variables: [
      {
        name: 'fileList',
        description: '文件列表',
      },
    ],
    writable: [],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '值改变',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
      {
        name: 'onRemove',
        description: '移除文件',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
    ],
  },
  description: '上传属性配置。',
  keywords: ['上传'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: {
        type: 'string',
      },
      listType: {
        type: 'string',
        enum: ['text', 'picture', 'picture-card', 'picture-circle'],
      },
      maxCount: {
        type: 'number',
        minimum: 1,
      },
      multiple: {
        type: 'boolean',
      },
      disabled: {
        type: 'boolean',
      },
      drag: {
        type: 'boolean',
      },
      showUploadList: {
        type: 'boolean',
      },
      accept: {
        type: 'string',
      },
      action: {
        type: 'string',
      },
      method: {
        type: 'string',
        enum: ['post', 'put'],
      },
      name: {
        type: 'string',
      },
      directory: {
        type: 'boolean',
      },
      openFileDialogOnClick: {
        type: 'boolean',
      },
      pastable: {
        type: 'boolean',
      },
      headers: {
        type: 'object',
      },
      data: {
        type: 'object',
      },
      withCredentials: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '用于表单中的上传。',
  constraints: ['必须置于 form 中。'],
});
