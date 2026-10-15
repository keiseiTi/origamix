import type { LogicNodes } from '@tangramino/engine';

/** Declarative event actions shared by preview and generated projects. */
export const logicNodes: LogicNodes = {
  setElementProps: ({ engine, data }) => {
    if (typeof data.elementId !== 'string' || !engine.elements[data.elementId]) return;
    if (!data.value || typeof data.value !== 'object' || Array.isArray(data.value)) return;
    engine.setState({ [data.elementId]: data.value as Record<string, unknown> });
  },
  visibleElement: ({ engine, data }) => {
    if (typeof data.elementId !== 'string' || !engine.elements[data.elementId]) return;
    if (data.visible === false) engine.hiddenElements([data.elementId]);
    else engine.showElements([data.elementId]);
  },
  setGlobalVariable: ({ engine, data }) => {
    if (typeof data.name === 'string' && data.name) engine.setGlobalVariable(data.name, data.value);
  },
};
