import { lazy } from 'react';
import { toEditorMaterial } from '../../src/origamix-material';
import { buttonDefinition } from './definition';

const ButtonMaterial = toEditorMaterial(
  buttonDefinition,
  lazy(() => import('./index')),
);

export default ButtonMaterial;
