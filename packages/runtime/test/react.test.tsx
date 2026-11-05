import { renderToStaticMarkup } from 'react-dom/server';
import { ORIGAMIX_VERSION } from '@origamix/shared';
import { DesignRenderer } from '../src/design';
import { expect, it } from 'vitest';
import type { RuntimeSchema as Schema } from '../src/core/types';

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
  expect(seen[0]?.om_setContextActions).toBeUndefined();
  expect(JSON.stringify(source)).toBe(before);
});

// A layout and page may reuse IDs; only page elements receive the page's executable bindings.
it('isolates layout nodes from page execution and rejects unsupported layout logic', async () => {
  const { OrigamixApplicationPage, OrigamixLayout, useLayoutNavigation } =
    await import('../src/layout');
  const { createEmptyLayoutDocument, PAGE_OUTLET_TYPE } = await import('@origamix/shared');
  const layout = createEmptyLayoutDocument('project_test');
  const base: Schema = {
    elements: {
      root: { type: 'container', props: {} },
      button: { type: 'button', props: { text: 'page' } },
    },
    layout: { root: 'root', structure: { root: ['button'] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
  };
  layout.schema = {
    ...base,
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
    elements: {
      root: { type: 'container', props: {} },
      button: { type: 'button', props: { text: 'layout' } },
      outlet: { type: PAGE_OUTLET_TYPE, props: {} },
    },
    layout: { root: 'root', structure: { root: ['button', 'outlet'] } },
  };
  const seen: Record<string, unknown>[] = [];
  const navigation: Array<ReturnType<typeof useLayoutNavigation>> = [];
  const materials = {
    container: (props: Record<string, unknown>) => <main>{props.children as React.ReactNode}</main>,
    button: (props: Record<string, unknown>) => {
      seen.push(props);
      navigation.push(useLayoutNavigation());
      return <button>{String(props.text)}</button>;
    },
  };
  const visited: string[] = [];
  const before = JSON.stringify([layout, base]);
  const markup = renderToStaticMarkup(
    <OrigamixApplicationPage
      pageId='page_home'
      schema={base}
      layout={{ enabled: true, document: layout }}
      materials={materials}
      navigation={{
        currentPageId: 'page_home',
        pageIds: ['page_home', 'page_other'],
        navigateToPage: (id) => {
          visited.push(id);
        },
      }}
    />,
  );
  expect(markup).toContain('<button>layout</button>');
  expect(markup).toContain('<button>page</button>');
  expect(seen[0]?.om_mode).toBe('render');
  expect(seen[0]?.om_setRuntimeState).toBeUndefined();
  expect(typeof seen[1]?.om_setRuntimeState).toBe('function');
  expect(navigation[0]?.navigateToPage('page_other')).toBe(true);
  expect(navigation[0]?.navigateToPage('page_foreign')).toBe(false);
  expect(visited).toEqual(['page_other']);
  expect(JSON.stringify([layout, base])).toBe(before);
  const disabled = renderToStaticMarkup(
    <OrigamixApplicationPage
      pageId='page_other'
      schema={base}
      layout={{ enabled: false }}
      materials={materials}
    />,
  );
  expect(disabled).toContain('<button>page</button>');
  expect(disabled).not.toContain('<button>layout</button>');
  const invalid = structuredClone(layout.schema);
  invalid.context.globalVariables = [{ name: 'forbidden' }];
  expect(() =>
    renderToStaticMarkup(
      <OrigamixLayout schema={invalid} materials={materials}>
        page
      </OrigamixLayout>,
    ),
  ).toThrow('布局 Schema 无效');
});
