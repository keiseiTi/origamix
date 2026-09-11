import { defineSimpleManifest, emptyContext, objectSchema } from '../manifest-definition';

export const uploadManifest = defineSimpleManifest(
  { type: 'upload', title: '上传', defaultProps: {}, context: emptyContext },
  {
    description: '选择并上传文件。',
    keywords: ['上传', '文件', '图片'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      listType: { type: 'string', enum: ['text', 'picture', 'picture-card'] },
      maxCount: { type: 'number', minimum: 1 },
      multiple: { type: 'boolean' },
      disabled: { type: 'boolean' },
      drag: { type: 'boolean' },
      showUploadList: { type: 'boolean' },
      accept: { type: 'string' },
      action: { type: 'string' },
      headers: { type: 'object' },
      data: { type: 'object' },
      name: { type: 'string' },
      withCredentials: { type: 'boolean' },
    }),
    usage: '用于表单中的文件提交。',
    constraints: ['必须置于 form 中。', '上传地址必须使用安全 URL。'],
  },
);
