import type { ReactNode } from 'react';
import { OrigamixLayout, resolveApplicationLayout, type OrigamixLayoutProps } from './layout';
import type { MaterialRegistry } from './core/types';

/** Common application composition. Hosts own routing, theme and read-only data acquisition. */
export const ApplicationShell = ({
  projectId,
  enabled,
  layout,
  materials,
  navigation,
  children,
}: {
  projectId: string;
  enabled: boolean;
  layout: unknown;
  materials: MaterialRegistry;
  navigation: OrigamixLayoutProps['navigation'];
  children: ReactNode;
}): React.JSX.Element => {
  const resolved = resolveApplicationLayout(projectId, enabled, layout);
  return resolved.enabled ? (
    <OrigamixLayout schema={resolved.document.schema} materials={materials} navigation={navigation}>
      {children}
    </OrigamixLayout>
  ) : (
    <>{children}</>
  );
};
