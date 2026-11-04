import type { EditorCore } from './editor-store';
import type {
  EditorElementPosition,
  EditorOperations,
  EditorResolvedPosition,
} from '../interfaces/editor-operation-interfaces';
import { editorSnapshot } from './editor-snapshots';
import { SchemaUtils } from '../schema/schema-utils';

/** All mutations return through the session's validated history/Working callback path. */
export const createEditorOperations = (
  read: () => EditorCore,
  write: () => EditorCore,
): Omit<EditorOperations, 'on'> => {
  const element = (id: string) => {
    const value = read().schema.elements[id];
    return value ? editorSnapshot({ id, ...value }) : undefined;
  };
  const resolve = (
    state: EditorCore,
    input: EditorElementPosition,
    movingId?: string,
  ): EditorResolvedPosition => {
    let parentId: string, index: number;
    const targetId =
      'beforeId' in input ? input.beforeId : 'afterId' in input ? input.afterId : undefined;
    if (targetId !== undefined) {
      if (targetId === movingId || !state.schema.elements[targetId])
        throw new Error('无效的目标元素');
      const parent = SchemaUtils.getParents(state.schema, targetId)[0];
      if (!parent) throw new Error('根元素不允许同级插入');
      parentId = parent;
      const siblings = (state.schema.layout.structure[parentId] ?? []).filter(
        (id) => id !== movingId,
      );
      index = siblings.indexOf(targetId) + ('afterId' in input ? 1 : 0);
    } else if ('parentId' in input) {
      parentId = input.parentId;
      index =
        input.index ??
        (state.schema.layout.structure[parentId] ?? []).filter((id) => id !== movingId).length;
    } else throw new Error('无效的插入位置');
    const length = (state.schema.layout.structure[parentId] ?? []).filter(
      (id) => id !== movingId,
    ).length;
    if (!Number.isInteger(index) || index < 0 || index > length) throw new Error('无效的插入索引');
    return { parentId, index };
  };
  const placement = (
    state: EditorCore,
    materialType: string,
    input: EditorElementPosition,
    movingId?: string,
  ): EditorResolvedPosition => {
    const material = state.materials.find((item) => item.type === materialType);
    if (!material) throw new Error('未知物料');
    const position =
      material.editorConfig?.presentation === 'overlay'
        ? {
            parentId: state.schema.layout.root,
            index: (state.schema.layout.structure[state.schema.layout.root] ?? []).filter(
              (id) => id !== movingId,
            ).length,
          }
        : resolve(state, input, movingId);
    const parent = state.schema.elements[position.parentId];
    const parentMaterial = state.materials.find((item) => item.type === parent?.type);
    if (
      !parent ||
      !parentMaterial?.acceptsChildren ||
      (material.dropTypes && !material.dropTypes.includes(parent.type))
    )
      throw new Error('该物料不允许放入目标容器');
    if (
      movingId &&
      (movingId === state.schema.layout.root ||
        movingId === position.parentId ||
        SchemaUtils.getParents(state.schema, position.parentId).includes(movingId))
    )
      throw new Error('不能移动根元素或放入自身子树');
    return position;
  };
  return {
    getSchema: () => editorSnapshot(read().schema),
    getElement: element,
    getMaterial: (type) => {
      const material = read().materials.find((item) => item.type === type);
      return material ? editorSnapshot(material) : undefined;
    },
    getParent: (id) => {
      const parent = SchemaUtils.getParents(read().schema, id)[0];
      return parent ? element(parent) : undefined;
    },
    getAncestors: (id) =>
      SchemaUtils.getParents(read().schema, id).map((parent) => element(parent)!),
    getSelectedElement: () => {
      const id = read().activeElement?.id;
      return id ? element(id)! : null;
    },
    insertElement: ({ materialType, props, position }) => {
      const state = write();
      if (state.rootMaterialTypes.includes(materialType)) throw new Error('根物料不能重复插入');
      const target = placement(state, materialType, position);
      const material = state.materials.find((item) => item.type === materialType)!;
      const id = `element-${crypto.randomUUID()}`;
      const result = SchemaUtils.insertElement(state.schema, target.parentId, {
        id,
        type: materialType,
        props: structuredClone({ ...material.defaultProps, ...props }),
      });
      const children = result.schema.layout.structure[target.parentId]!;
      children.splice(children.indexOf(id), 1);
      children.splice(target.index, 0, id);
      state.setSchema(result.schema, { source: 'plugin' });
      return id;
    },
    moveElement: ({ elementId, position }) => {
      const state = write();
      const current = state.schema.elements[elementId];
      if (!current) throw new Error('元素不存在');
      const target = placement(state, current.type, position, elementId);
      const result = SchemaUtils.moveElement(state.schema, elementId, target.parentId);
      const children = result.schema.layout.structure[target.parentId]!;
      children.splice(children.indexOf(elementId), 1);
      children.splice(target.index, 0, elementId);
      state.setSchema(result.schema, { source: 'plugin', movedElementId: elementId });
    },
    removeElement: (id) => {
      const state = write();
      state.setSchema(SchemaUtils.removeElement(state.schema, id).schema, { source: 'plugin' });
    },
    updateElementProps: (id, props) => {
      const state = write();
      state.setSchema(
        SchemaUtils.setElementProps(state.schema, id, structuredClone(props)).schema,
        { source: 'plugin' },
      );
    },
    removeElementProps: (id, fields) => {
      const state = write();
      const current = state.schema.elements[id];
      if (!current) throw new Error('元素不存在');
      const props = Object.fromEntries(
        Object.entries(current.props).filter(([key]) => !fields.includes(key)),
      );
      state.setSchema(
        { ...state.schema, elements: { ...state.schema.elements, [id]: { ...current, props } } },
        { source: 'plugin' },
      );
    },
    selectElement: (id) => {
      const state = read();
      if (id === null) {
        state.setActiveElement(null, 'plugin');
        return;
      }
      const current = state.schema.elements[id];
      const material = state.materials.find((item) => item.type === current?.type);
      if (!current || !material) throw new Error('元素或物料不存在');
      state.setActiveElement({ id, ...current, material }, 'plugin');
    },
  };
};
