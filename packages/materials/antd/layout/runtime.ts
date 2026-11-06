import PageOutlet from '../page-outlet';
import { Layout, LayoutRegion } from './index';
import { Container } from '../container';
import { Text } from '../text';
import { Button } from '../button';
import { registerRuntimeMaterial } from '../runtime-state';
import { antdLayoutManifest } from './manifest';
export { RuntimeProvider } from '../runtime-provider';
export { materialSet } from '../material-set';
const components = {
  Layout,
  LayoutRegion,
  PageOutlet,
  container: Container,
  text: Text,
  button: Button,
};
export default Object.fromEntries(
  Object.entries(components).map(([type, Component]) => [
    type,
    registerRuntimeMaterial(
      Component,
      antdLayoutManifest.materials.find((material) => material.type === type)!,
    ),
  ]),
);
