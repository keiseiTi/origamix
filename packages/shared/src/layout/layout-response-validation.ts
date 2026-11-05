import { Value } from '@sinclair/typebox/value';
import {
  LayoutConfigStateSchema,
  LayoutWorkingStateSchema,
  LayoutRevisionHistorySchema,
  LayoutRevisionSnapshotSchema,
  LayoutApplyStateSchema,
  LayoutApplyResultSchema,
  type LayoutConfigState,
  type LayoutWorkingState,
  type LayoutRevisionHistory,
  type LayoutRevisionSnapshot,
  type LayoutApplyState,
  type LayoutApplyResult,
} from './layout-api.ts';
export const isLayoutConfigState = (value: unknown): value is LayoutConfigState =>
  Value.Check(LayoutConfigStateSchema, value);
export const isLayoutWorkingState = (value: unknown): value is LayoutWorkingState =>
  Value.Check(LayoutWorkingStateSchema, value);
export const isLayoutRevisionHistory = (value: unknown): value is LayoutRevisionHistory =>
  Value.Check(LayoutRevisionHistorySchema, value);
export const isLayoutRevisionSnapshot = (value: unknown): value is LayoutRevisionSnapshot =>
  Value.Check(LayoutRevisionSnapshotSchema, value);
export const isLayoutApplyState = (value: unknown): value is LayoutApplyState =>
  Value.Check(LayoutApplyStateSchema, value);
export const isLayoutApplyResult = (value: unknown): value is LayoutApplyResult =>
  Value.Check(LayoutApplyResultSchema, value);
