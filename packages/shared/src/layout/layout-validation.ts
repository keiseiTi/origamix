import { Value } from '@sinclair/typebox/value';
import { isPageSchema } from '../page/page-validation.ts';
import {
  PAGE_OUTLET_TYPE,
  PageOutletPropsSchema,
  ProjectLayoutDocumentSchema,
  type LayoutSchema,
  type ProjectLayoutDocument,
} from './layout-schema.ts';

export interface LayoutValidationIssue {
  code: string;
  path: string;
  message: string;
}

/** Interpreted, safe in design frames with code generation disabled. */
export const validateLayoutSchema = (value: unknown): LayoutValidationIssue[] => {
  if (!isPageSchema(value))
    return [{ code: 'INVALID_LAYOUT_SCHEMA', path: '/', message: '布局 Schema 结构或版本无效' }];
  const errors: LayoutValidationIssue[] = [];
  if (
    Object.keys(value.flows).length ||
    value.bindElements.length ||
    value.context.globalVariables.length
  )
    errors.push({
      code: 'LAYOUT_LOGIC_NOT_SUPPORTED',
      path: '/',
      message: '布局暂不支持业务流程、事件绑定或全局变量',
    });
  const outlets = Object.entries(value.elements).filter(
    ([, element]) => element.type === PAGE_OUTLET_TYPE,
  );
  if (outlets.length !== 1)
    errors.push({
      code: 'INVALID_PAGE_OUTLET',
      path: '/elements',
      message: '每个布局必须且只能有一个页面内容区',
    });
  const reachable = new Set<string>();
  const visit = (id: string): void => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of value.layout.structure[id] ?? []) visit(child);
  };
  visit(value.layout.root);
  for (const [id, element] of outlets) {
    if (
      !reachable.has(id) ||
      (value.layout.structure[id]?.length ?? 0) > 0 ||
      !Value.Check(PageOutletPropsSchema, element.props)
    )
      errors.push({
        code: 'INVALID_PAGE_OUTLET',
        path: `/elements/${id}`,
        message: '页面内容区必须可达、没有子节点且属性有效',
      });
  }
  if (reachable.size !== Object.keys(value.elements).length)
    errors.push({
      code: 'UNREACHABLE_LAYOUT_ELEMENT',
      path: '/layout',
      message: '布局不能包含游离节点',
    });
  return errors;
};
export const isLayoutSchema = (value: unknown): value is LayoutSchema =>
  validateLayoutSchema(value).length === 0;

/** Layout content has one project owner; enablement belongs only to its manifest. */
export const validateLayoutDocument = (value: unknown): LayoutValidationIssue[] => {
  if (!Value.Check(ProjectLayoutDocumentSchema, value))
    return [
      {
        code: 'INVALID_LAYOUT_DOCUMENT',
        path: '/',
        message: '布局文档结构或契约版本不受支持，原数据已保留',
      },
    ];
  return validateLayoutSchema(value.schema).map((issue) => ({
    ...issue,
    path: `/schema${issue.path}`,
  }));
};
export const isLayoutDocument = (value: unknown): value is ProjectLayoutDocument =>
  validateLayoutDocument(value).length === 0;
