import { defineSimpleManifest, objectSchema, emptyContext } from '../manifest-definition';
export const uploadManifest = defineSimpleManifest(
  {
    type: 'upload',
    title: '上传',
    defaultProps: { text: '选择文件', showUploadList: true, openFileDialogOnClick: true },
    context: emptyContext,
  },
  {
    description: '上传属性配置。',
    keywords: ['上传'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    documentationUrl: 'https://ant.design/components/upload/#api',
    propsSchema: objectSchema({
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
    }),
    usage: '用于表单中的上传。',
    constraints: ['必须置于 form 中。'],
  },
);
