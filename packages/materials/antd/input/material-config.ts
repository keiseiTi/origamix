import { lazy } from 'react';
import { toEditorMaterial } from '../../src/origamix-material';
import { inputDefinition } from './definition';

const InputMaterial = toEditorMaterial(
  inputDefinition,
  lazy(() => import('./index')),
);

export default InputMaterial;
