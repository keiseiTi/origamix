import { useMemo, type ReactNode, type HTMLAttributes, type RefAttributes } from 'react';
import { SCHEMA_VERSION } from '@origamix/shared';
import { parseLayout } from './core/layout';
import type { MaterialRegistry, RuntimeSchema } from './core/types';
import { DiagnosticsProvider, type RuntimeDiagnosticsProps } from './diagnostics';
import { MaterialView, renderLayout } from './renderer';

export interface DesignElementProps {
  id: string;
  type: string;
  props: Readonly<Record<string, unknown>>;
  children?: ReactNode;
  tabKey?: unknown;
  root?: boolean;
  renderMaterial: (
    extraProps?: Record<string, unknown>,
    frameProps?: HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>,
    options?: { framePlacement?: 'content' },
  ) => React.JSX.Element;
}
export interface DesignRendererProps extends RuntimeDiagnosticsProps {
  schema: RuntimeSchema;
  materials: MaterialRegistry;
  renderElement: (element: DesignElementProps) => ReactNode;
}
/** Declarative rendering only: no Engine, event bindings, evaluator or business lifecycle. */
export const DesignRenderer = ({
  schema,
  materials,
  renderElement,
  onOutcome,
  onDiagnosticsChange,
  onRenderError,
  renderElementError,
}: DesignRendererProps): React.JSX.Element => {
  const layouts = useMemo(() => {
    if (
      (schema.extensions.origamix as { schemaVersion?: unknown } | undefined)?.schemaVersion !==
      SCHEMA_VERSION
    )
      throw new Error('页面版本不受支持');
    return parseLayout(schema);
  }, [schema]);

  return (
    <DiagnosticsProvider
      onOutcome={onOutcome}
      onDiagnosticsChange={onDiagnosticsChange}
      onRenderError={onRenderError}
      renderElementError={renderElementError}
    >
      {renderLayout(layouts, (node, children) => {
        const element = schema.elements[node.id]!;
        return (
          <DesignElement
            key={node.id}
            root={node.id === schema.layout.root}
            id={node.id}
            type={element.type}
            props={element.props}
            tabKey={element.props.tabKey}
            children={children}
            materials={materials}
            renderElement={renderElement}
          />
        );
      })}
    </DiagnosticsProvider>
  );
};
const DesignElement = ({
  id,
  type,
  props,
  children,
  materials,
  renderElement,
  root,
}: Omit<DesignElementProps, 'renderMaterial'> &
  Pick<DesignRendererProps, 'materials' | 'renderElement'>): ReactNode => {
  // Business event props never reach materials in design mode.
  const designProps = Object.fromEntries(
    Object.entries(props).filter(
      ([key]) => !/^on[A-Z]/.test(key) && key !== 'init' && !key.startsWith('om_'),
    ),
  );
  return renderElement({
    root,
    id,
    type,
    props: designProps,
    children,
    renderMaterial: (extraProps = {}, frameProps, options) => (
      <MaterialView
        resetToken={props}
        root={root}
        frameProps={frameProps}
        framePlacement={options?.framePlacement}
        id={id}
        type={type}
        components={materials}
        props={{
          ...designProps,
          ...extraProps,
          om_mode: 'design',
          om_setRuntimeState: undefined,
          om_setContextActions: undefined,
          init: undefined,
        }}
      >
        {children}
      </MaterialView>
    ),
  });
};
