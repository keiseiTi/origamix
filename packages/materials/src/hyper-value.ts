import type { Param } from './custom-types';

export type StringValue = {
  type: 'string';
  value?: string;
};

export type NumberValue = {
  type: 'number';
  value?: number | null;
};

export type BooleanValue = {
  type: 'boolean';
  value?: boolean;
};

export type NullValue = {
  type: 'null';
  value?: null;
};

export type ExpressionValue = {
  type: 'expression';
  value?: string;
};

export type FunctionValue = {
  type: 'function';
  value?: {
    params?: Param[];
    body?: string;
  };
};

export type ContextConfigValue = {
  type: 'contextValue';
  value?: string;
};

export type HyperValue =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | ExpressionValue
  | FunctionValue
  | ContextConfigValue;
