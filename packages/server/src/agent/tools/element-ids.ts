import { nanoid } from 'nanoid';
import { createElementId, type SchemaOperation } from '@origamix/shared';
import { SchemaValidationError } from '../../schema/validation/schema-validation';

export const createAgentElementIds = () => {
  const allocations = new Map<string, string>();
  return {
    allocate: (type: string, isTaken?: (id: string) => boolean) => {
      const id = createElementId(
        type,
        nanoid,
        (candidate) => allocations.has(candidate) || Boolean(isTaken?.(candidate)),
      );
      allocations.set(id, type);
      return id;
    },
    validate: (operations: readonly SchemaOperation[]): void => {
      for (const [operationIndex, operation] of operations.entries()) {
        const added =
          operation.operation === 'addElement' ||
          (operation.operation === 'replaceElement' && allocations.has(operation.elementId))
            ? ([[operation.elementId, operation.element]] as const)
            : operation.operation === 'insertSubtree'
              ? Object.entries(operation.elements)
              : [];
        for (const [id, element] of added) {
          if (allocations.get(id) !== element.type)
            throw new SchemaValidationError({
              code: 'UNALLOCATED_ELEMENT_ID',
              path: `/operations/${operationIndex}`,
              operationIndex,
              message:
                '新增元素必须使用本次 Run 通过 allocate_element_ids 或 prepare_block 为该物料类型生成的 ID，并同步更新批次中的引用。',
            });
        }
      }
    },
  };
};

export type AgentElementIds = ReturnType<typeof createAgentElementIds>;
