import { renderToStaticMarkup } from 'react-dom/server';
import { ORIGAMIX_VERSION } from '@origamix/shared';
import { DesignRenderer } from '../design';
import { describe, expect, it } from 'vitest';
import type { RuntimeSchema as Schema } from '../core/types';
import { findUnknownMaterialTypes } from '../react';

describe('page preview', () => {
  it('rejects a Schema whose material is unavailable to the renderer', () => {
    const schema = {
      elements: {
        root: { id: 'root', type: 'known', props: {}, children: ['missing'] },
        missing: { id: 'missing', type: 'unknown', props: {}, children: [] },
      },
      root: 'root',
    } as unknown as Schema;
    expect(findUnknownMaterialTypes(schema, { known: () => null })).toContain('unknown');
  });
});

// Editor must never bind executable page events in the trusted workbench.
it('renders design materials without event execution, runtime authority or source mutation', () => {
  const source: Schema = {
    elements: {
      root: { type: 'container', props: {} },
      button: { type: 'button', props: { text: 'edit' } },
    },
    layout: { root: 'root', structure: { root: ['button'] } },
    context: { globalVariables: [] },
    flows: {
      click: {
        startId: 'start',
        nodes: {
          start: { id: 'start', type: 'start', props: {}, prev: [], next: ['code'] },
          code: {
            id: 'code',
            type: 'customJS',
            props: {
              value: {
                type: 'function',
                value: { params: [], body: 'throw new Error("must not execute")' },
              },
            },
            prev: ['start'],
            next: [],
          },
        },
      },
    },
    bindElements: [{ id: 'button', event: 'init', flowId: 'click' }],
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
  };
  const before = JSON.stringify(source);
  const seen: Record<string, unknown>[] = [];
  const markup = renderToStaticMarkup(
    <DesignRenderer
      schema={source}
      materials={{
        container: (props: Record<string, unknown>) => (
          <main>{props.children as React.ReactNode}</main>
        ),
        button: (props: Record<string, unknown>) => {
          seen.push(props);
          return <button>{String(props.text)}</button>;
        },
      }}
      renderElement={(element) => element.renderMaterial()}
    />,
  );
  expect(markup).toContain('<button>edit</button>');
  expect(seen[0]?.om_mode).toBe('design');
  expect(seen[0]?.init).toBeUndefined();
  expect(seen[0]?.om_setRuntimeState).toBeUndefined();
  expect(seen[0]?.om_setContextValues).toBeUndefined();
  expect(JSON.stringify(source)).toBe(before);
});
