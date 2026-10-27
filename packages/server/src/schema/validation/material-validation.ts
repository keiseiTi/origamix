import { isFlowNodeProps, type FlowNodeType, type OrigamixPageSchema } from '@origamix/shared';
import { validateFlowReferences } from './flow-reference-validation';
import { builtinProjectMaterials, loadProjectMaterials } from '../../projects/project-materials';
import {
  createMaterialValidationError as error,
  isRecord,
  type MaterialValidationError,
  type MaterialValidationResult,
  type MaterialValidationRuntime,
} from './validation-contracts';
import { propsValidator, propertyPath, inspectSafeValues } from './material-props-validation';
import { validateMaterialSemantics, validateMaterialStructure } from './material-semantics';

export const defaultMaterialValidationRuntime: MaterialValidationRuntime =
  builtinProjectMaterials.validation;

export const validatePageAgainstMaterials = (
  schema: OrigamixPageSchema,
  projectMaterialSets: readonly { id: string; version: string }[],
  runtime: MaterialValidationRuntime = defaultMaterialValidationRuntime,
  executableFlowIds?: ReadonlySet<string>,
): MaterialValidationResult => {
  const errors: MaterialValidationError[] = [];
  if (
    !projectMaterialSets.some(
      (set) => set.id === runtime.materialSet.id && set.version === runtime.materialSet.version,
    )
  ) {
    errors.push(
      error(
        'MATERIAL_SET_VERSION_MISMATCH',
        '/materialSets',
        `Project requires ${runtime.materialSet.id}@${runtime.materialSet.version}`,
      ),
    );
  }
  for (const manifest of Object.values(runtime.registry)) {
    if (manifest.version !== runtime.materialSet.version) {
      errors.push(
        error(
          'MATERIAL_SET_VERSION_MISMATCH',
          `/materials/${manifest.type}/version`,
          `Manifest ${manifest.type}@${manifest.version} does not match runtime ${runtime.materialSet.version}`,
          undefined,
          manifest.type,
        ),
      );
    }
  }

  for (const [elementId, element] of Object.entries(schema.elements)) {
    if (element.type === 'basicPage') {
      if (elementId !== schema.layout.root)
        errors.push(
          error(
            'INVALID_PARENT',
            `/elements/${elementId}`,
            'basicPage is reserved for the layout root',
            elementId,
            element.type,
          ),
        );
    }
    const manifest = runtime.registry[element.type];
    if (!manifest) {
      errors.push(
        error(
          'UNKNOWN_MATERIAL',
          `/elements/${elementId}/type`,
          `Unknown material: ${element.type}`,
          elementId,
          element.type,
        ),
      );
      continue;
    }
    const validateProps = propsValidator(manifest);
    if (!validateProps(element.props)) {
      for (const ajvError of validateProps.errors ?? []) {
        errors.push(
          error(
            'INVALID_MATERIAL_PROPS',
            propertyPath(elementId, ajvError),
            ajvError.message ?? 'Invalid material property',
            elementId,
            element.type,
          ),
        );
      }
    }
    validateMaterialSemantics(elementId, element, errors);
    inspectSafeValues(
      element.props,
      `/elements/${elementId}/props`,
      elementId,
      element.type,
      errors,
    );
  }

  validateMaterialStructure(schema, runtime, errors);

  for (const [index, rawBinding] of schema.bindElements.entries()) {
    const path = `/bindElements/${index}`;
    if (!rawBinding || typeof rawBinding !== 'object') {
      errors.push(error('INVALID_BINDING', path, 'Binding must be an object'));
      continue;
    }
    const binding = rawBinding as Record<string, unknown>;
    const elementId = typeof binding['id'] === 'string' ? binding['id'] : undefined;
    const element = elementId ? schema.elements[elementId] : undefined;
    const materialType = element?.type;
    if (
      !elementId ||
      !element ||
      typeof binding['event'] !== 'string' ||
      typeof binding['flowId'] !== 'string' ||
      !schema.flows[binding['flowId']]
    ) {
      errors.push(
        error(
          'INVALID_BINDING',
          path,
          'Binding must reference an existing element, event and flow',
          elementId,
          materialType,
        ),
      );
      continue;
    }
    const manifest = runtime.registry[element.type];
    if (!manifest?.context.methods.some((entry) => entry.name === binding['event'])) {
      errors.push(
        error(
          'UNKNOWN_EVENT',
          `${path}/event`,
          `Event ${String(binding['event'])} is not declared by ${element.type}`,
          elementId,
          element.type,
        ),
      );
    }
  }
  for (const [flowId, flow] of Object.entries(schema.flows ?? {})) {
    const flowPath = `/flows/${flowId.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (!isRecord(flow) || !isRecord(flow.nodes)) {
      errors.push(error('INVALID_FLOW_PROPS', flowPath, 'Flow must contain a nodes object'));
      continue;
    }
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const path = `${flowPath}/nodes/${nodeId.replaceAll('~', '~0').replaceAll('/', '~1')}/props`;
      if (!isRecord(node)) {
        errors.push(error('INVALID_FLOW_PROPS', path, 'Flow node must be an object'));
        continue;
      }
      const valid =
        typeof node.type === 'string' && isFlowNodeProps(node.type as FlowNodeType, node.props);
      if (!valid)
        errors.push(
          error(
            'INVALID_FLOW_PROPS',
            path,
            'Flow node parameters do not match the Shared contract',
          ),
        );
      inspectSafeValues(
        node.props,
        path,
        schema.layout.root,
        schema.elements[schema.layout.root]?.type ?? 'basicPage',
        errors,
        valid,
      );
    }
  }
  errors.push(...validateFlowReferences(schema, runtime.registry, executableFlowIds));
  return { valid: errors.length === 0, errors };
};

export const validateProjectPageAgainstMaterials = async (
  projectPath: string,
  schema: OrigamixPageSchema,
  runtime?: MaterialValidationRuntime,
  executableFlowIds?: ReadonlySet<string>,
): Promise<MaterialValidationResult> => {
  const materials = await loadProjectMaterials(projectPath);
  return validatePageAgainstMaterials(
    schema,
    [materials.manifest.materialSet],
    runtime ?? materials.validation,
    executableFlowIds,
  );
};
