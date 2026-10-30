import type { MaterialManifest } from '@origamix/shared';
import { withCommonMaterialManifest } from '../src/material-manifest';
import { materialSet } from './material-set';

/** Restore shared protocol data without importing components or editor configuration. */
export const withMaterialManifestDefaults = (
  manifest: Omit<MaterialManifest, 'version'>,
): MaterialManifest => withCommonMaterialManifest({ ...manifest, version: materialSet.version });
