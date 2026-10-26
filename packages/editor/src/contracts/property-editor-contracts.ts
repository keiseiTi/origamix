import type { AttributeConfig } from './material-contracts';
import type { ComponentType } from 'react';
import type { EditorPageScope } from './editor-contracts';

/** A property editor can change only the selected element's props, atomically. */
export type ElementPropsChange = Readonly<{
  set?: Readonly<Record<string, unknown>>;
  unset?: readonly string[];
}>;

export type PropertyEditorProps<Value = unknown> = Readonly<{
  scope: EditorPageScope;
  elementId: string;
  field: string;
  value: Value;
  readOnly: boolean;
  validationMessage?: string;
  /** Resolves when accepted into the Editor transaction; flush confirms Server persistence. */
  onCommit: (change: ElementPropsChange) => Promise<void>;
}>;

/** Components remain outside the serializable Manifest. The pair identifies one field editor. */
export type PropertyEditorRegistration = Readonly<{
  materialType: string;
  field: string;
  Component: ComponentType<PropertyEditorProps>;
}>;

/** Structured field validation is an editor concern and never serialized in a Manifest. */
export type JsonAttributeConfig = AttributeConfig & {
  uiType: 'json';
  validateValue: (value: unknown) => string | undefined;
};
