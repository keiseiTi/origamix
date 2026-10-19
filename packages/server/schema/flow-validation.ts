import {
  isFlowNodeProps,
  isHyperValue,
  PageFlowSchema,
  type FlowNodeType,
  type OrigamixPageSchema,
  type PageFlow,
  type ValidationMaterialManifest,
} from '@origamix/shared';
import { Check } from '@sinclair/typebox/value';
import type { MaterialValidationError } from './material-validation';

const pointer = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');
const safeKey = (key: string): boolean => !['__proto__', 'prototype', 'constructor'].includes(key);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const reachableFrom = (flow: PageFlow, startId: string, excluded?: string): Set<string> => {
  const visited = new Set<string>();
  const pending = [startId];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === excluded || visited.has(id) || !Object.hasOwn(flow.nodes, id)) continue;
    visited.add(id);
    pending.push(...flow.nodes[id]!.next);
  }
  return visited;
};

/** Validates declarative references only; project expressions/functions are never executed. */
export const validateFlowReferences = (
  schema: OrigamixPageSchema,
  registry: Readonly<Record<string, ValidationMaterialManifest>>,
  executableFlowIds: ReadonlySet<string> = new Set(),
): MaterialValidationError[] => {
  const errors: MaterialValidationError[] = [];
  const globals = new Set(
    schema.context.globalVariables.flatMap((value) =>
      record(value) && typeof value.name === 'string' ? [value.name] : [],
    ),
  );
  const report = (
    path: string,
    message: string,
    code: MaterialValidationError['code'] = 'INVALID_FLOW_REFERENCE',
  ): void => {
    errors.push({ code, path, message, elementId: null, materialType: null });
  };

  for (const [flowId, flow] of Object.entries(schema.flows)) {
    // The normal write pipeline checks shape first; standalone material diagnostics may not.
    if (!Check(PageFlowSchema, flow)) continue;
    const complete = executableFlowIds.has(flowId);
    const reachable = reachableFrom(flow, flow.startId);
    const withoutResult = new Map<string, Set<string>>();
    for (const [nodeId, node] of Object.entries(flow.nodes)) {
      const path = `/flows/${pointer(flowId)}/nodes/${pointer(nodeId)}`;
      if (complete && !reachable.has(nodeId))
        report(path, 'Generated flow contains an unreachable node', 'INCOMPLETE_FLOW');
      const target = (id: string, at: string): ValidationMaterialManifest | undefined => {
        if (!id && !complete) return undefined;
        if (!safeKey(id) || !Object.hasOwn(schema.elements, id)) {
          report(at, 'Target must be an existing element in this page');
          return undefined;
        }
        return registry[schema.elements[id]!.type];
      };
      const reference = (value: string, at: string): void => {
        if (!value && !complete) return;
        const [kind, name, ...parts] = value.split('.');
        if (!name || !safeKey(name) || parts.some((part) => !part || !safeKey(part))) {
          report(at, 'Invalid context reference');
          return;
        }
        if (kind === 'global') {
          if (!globals.has(name)) report(at, 'Global variable must be declared in this page');
        } else if (kind === 'state' || kind === 'method') {
          const manifest = target(name, at);
          if (!manifest) return;
          if (kind === 'method') {
            if (
              parts.length !== 1 ||
              !manifest.context.values.some((entry) => entry.isMethod && entry.name === parts[0])
            )
              report(at, 'Context method must be declared by the target material');
          } else if (
            parts.length &&
            !Object.hasOwn(manifest.propsSchema['properties'] ?? {}, parts[0]!) &&
            !manifest.context.variables.some((entry) => entry.name === parts[0])
          ) {
            report(at, 'State property must be declared by the target material');
          }
        } else if (kind === 'result') {
          if (
            !Object.hasOwn(flow.nodes, name) ||
            name === nodeId ||
            flow.nodes[name]?.type === 'start'
          ) {
            report(at, 'Result must reference another non-start node in the same flow');
          } else if (complete) {
            let bypass = withoutResult.get(name);
            if (!bypass) {
              bypass = reachableFrom(flow, flow.startId, name);
              withoutResult.set(name, bypass);
            }
            if (!reachable.has(name) || bypass.has(nodeId))
              report(at, 'Result node must execute before this node on every path');
          }
        } else report(at, 'Unknown context namespace');
      };

      // Only recognized node parameters may contain executable HyperValue envelopes.
      if (!isFlowNodeProps(node.type as FlowNodeType, node.props)) continue;
      const inspect = (value: unknown, at: string): void => {
        if (isHyperValue(value)) {
          if (value.type === 'contextValue') reference(value.value, `${at}/value`);
          if (value.type === 'function') {
            const names = new Set<string>();
            for (const [index, param] of value.value.params.entries()) {
              if (
                (param.name || complete) &&
                (!/^[A-Za-z_$][\w$]*$/.test(param.name) ||
                  !safeKey(param.name) ||
                  names.has(param.name))
              )
                report(
                  `${at}/value/params/${index}/name`,
                  'Function parameters must have valid unique names',
                );
              names.add(param.name);
              reference(param.value, `${at}/value/params/${index}/value`);
            }
            if (complete && !value.value.body.trim())
              report(
                `${at}/value/body`,
                'Generated function body cannot be empty',
                'INCOMPLETE_FLOW',
              );
          }
          if (complete && value.type === 'expression' && !value.value.trim())
            report(`${at}/value`, 'Generated expression cannot be empty', 'INCOMPLETE_FLOW');
          return;
        }
        if (Array.isArray(value)) value.forEach((item, index) => inspect(item, `${at}/${index}`));
        else if (record(value))
          for (const [key, item] of Object.entries(value)) inspect(item, `${at}/${pointer(key)}`);
      };
      inspect(node.props, `${path}/props`);

      if (node.type === 'setElementProps' && isFlowNodeProps('setElementProps', node.props)) {
        for (const [index, setter] of node.props.setters.entries()) {
          const at = `${path}/props/setters/${index}`;
          const manifest = target(setter.elementId, `${at}/elementId`);
          if (
            manifest &&
            (setter.propName || complete) &&
            (!safeKey(setter.propName) ||
              (!Object.hasOwn(manifest.propsSchema['properties'] ?? {}, setter.propName) &&
                !manifest.context.variables.some((entry) => entry.name === setter.propName)))
          )
            report(`${at}/propName`, 'Property must be declared by the target material');
          if (complete && !setter.propName)
            report(
              `${at}/propName`,
              'Generated property target cannot be empty',
              'INCOMPLETE_FLOW',
            );
        }
        if (complete && !node.props.setters.length)
          report(
            `${path}/props/setters`,
            'Generated setter list cannot be empty',
            'INCOMPLETE_FLOW',
          );
      }
      if (node.type === 'emitElementAction' && isFlowNodeProps('emitElementAction', node.props)) {
        for (const [index, setter] of node.props.setters.entries()) {
          const at = `${path}/props/setters/${index}`;
          const manifest = target(setter.elementId, `${at}/elementId`);
          if (
            manifest &&
            (setter.methodName || complete) &&
            !manifest.context.values.some(
              (entry) => entry.isMethod && entry.name === setter.methodName,
            )
          )
            report(
              `${at}/methodName`,
              'Method must be declared as a callable context value, not an event',
            );
        }
        if (complete && !node.props.setters.length)
          report(
            `${path}/props/setters`,
            'Generated method list cannot be empty',
            'INCOMPLETE_FLOW',
          );
      }
      if (node.type === 'visibleElement' && isFlowNodeProps('visibleElement', node.props)) {
        node.props.elementIds.forEach((id, index) =>
          target(id, `${path}/props/elementIds/${index}`),
        );
        if (complete && !node.props.elementIds.length)
          report(
            `${path}/props/elementIds`,
            'Generated visibility targets cannot be empty',
            'INCOMPLETE_FLOW',
          );
      }
      if (
        (node.type === 'openModalDrawer' || node.type === 'closeModalDrawer') &&
        isFlowNodeProps('openModalDrawer', node.props)
      ) {
        const id = node.props.elementId;
        const manifest = target(id, `${path}/props/elementId`);
        if (manifest && !['modal', 'drawer'].includes(manifest.type))
          report(`${path}/props/elementId`, 'Target must be a modal or drawer');
      }
      if (node.type === 'setGlobalVariable' && isFlowNodeProps('setGlobalVariable', node.props)) {
        for (const [index, setter] of node.props.setters.entries())
          if ((setter.name || complete) && (!safeKey(setter.name) || !globals.has(setter.name)))
            report(
              `${path}/props/setters/${index}/name`,
              'Global variable must be declared in this page',
            );
        if (complete && !node.props.setters.length)
          report(
            `${path}/props/setters`,
            'Generated variable list cannot be empty',
            'INCOMPLETE_FLOW',
          );
      }
      if (
        complete &&
        node.type === 'interfaceRequest' &&
        isFlowNodeProps('interfaceRequest', node.props) &&
        node.props.url.type === 'string'
      ) {
        try {
          const url = new URL(node.props.url.value);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
            throw new Error('Invalid URL');
        } catch {
          report(
            `${path}/props/url`,
            'Literal request URL must be an HTTP(S) URL without embedded credentials',
          );
        }
      }
    }
  }
  return errors;
};
