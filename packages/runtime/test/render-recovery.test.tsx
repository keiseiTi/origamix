// @vitest-environment happy-dom
import { act, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ORIGAMIX_VERSION, createEmptyLayoutDocument, PAGE_OUTLET_TYPE } from '@origamix/shared';
import { OrigamixApplicationPage } from '../src/layout';
import { OrigamixPage } from '../src/react';
import { DesignRenderer } from '../src/design';
import type { RuntimeOutcome, RuntimeSchema, MaterialRegistry } from '../src';

// Core preview/edit recovery: render failures must retain a usable sibling and cannot
// be overwritten by a success outcome. Server tests cannot prove React commit behavior.
it('isolates failed preview elements, retains sibling state and clears diagnostics only after recovery', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const outcomes: RuntimeOutcome[] = [];
  const onOutcome = (outcome: RuntimeOutcome) => outcomes.push(outcome);
  let broken = true;
  const schema: RuntimeSchema = {
    elements: {
      root: { type: 'container', props: {} },
      bad: { type: 'broken', props: {} },
      missing: { type: 'missing', props: {} },
      healthy: { type: 'input', props: {} },
    },
    layout: { root: 'root', structure: { root: ['bad', 'missing', 'healthy'] } },
    context: { globalVariables: [] },
    flows: {},
    bindElements: [],
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
  };
  const Healthy = () => {
    const [count, setCount] = useState(0);
    return (
      <button data-healthy onClick={() => setCount(count + 1)}>
        count:{count}
      </button>
    );
  };
  const materials: MaterialRegistry = {
    container: ({ children }: { children?: ReactNode }) => <main>{children}</main>,
    broken: () => {
      if (broken) throw new Error('bad property detail');
      return <span>recovered</span>;
    },
    input: Healthy,
  };
  const render = async (mode: 'run' | 'design', source = schema, registry = materials) => {
    await act(async () =>
      root.render(
        mode === 'run' ? (
          <OrigamixPage
            schema={source}
            materials={registry}
            resetKey='session'
            onOutcome={onOutcome}
          />
        ) : (
          <DesignRenderer
            schema={source}
            materials={registry}
            onOutcome={onOutcome}
            renderElement={(element) =>
              element.renderMaterial(
                {},
                { 'aria-label': element.id },
                { framePlacement: 'content' },
              )
            }
          />
        ),
      ),
    );
  };
  const retry = async (id: string) => {
    const button = host.querySelector<HTMLButtonElement>(`[data-element-id="${id}"] button`)!;
    expect(button).not.toBeNull();
    await act(async () => button.click());
  };
  try {
    await render('run');
    expect(host.textContent).toContain('bad property detail');
    expect(outcomes.every((entry) => entry.outcome === 'failed')).toBe(true);
    expect(
      outcomes
        .at(-1)
        ?.diagnostics.map((entry) => entry.elementId)
        .sort(),
    ).toEqual(['bad', 'missing']);
    const healthy = host.querySelector<HTMLButtonElement>('[data-healthy]')!;
    await act(async () => healthy.click());
    await retry('bad');
    expect(outcomes.at(-1)?.outcome).toBe('failed');
    expect(host.querySelector('[data-healthy]')).toBe(healthy);
    expect(healthy.textContent).toBe('count:1');
    broken = false;
    await retry('bad');
    expect(host.textContent).toContain('recovered');
    expect(outcomes.at(-1)?.diagnostics.map((entry) => entry.elementId)).toEqual(['missing']);
    await render('run', schema, { ...materials, missing: () => <span>installed</span> });
    expect(outcomes.at(-1)).toEqual({ outcome: 'success', diagnostics: [] });
    expect(host.querySelector('[data-healthy]')).toBe(healthy);

    broken = true;
    await render('design');
    expect(host.querySelector('[aria-label="bad"] [role="alert"]')).not.toBeNull();
    expect(outcomes.at(-1)?.outcome).toBe('failed');
    const fixed = {
      ...schema,
      elements: { ...schema.elements, bad: { ...schema.elements.bad!, props: { fixed: true } } },
    };
    broken = false;
    await render('design', fixed);
    expect(outcomes.at(-1)?.diagnostics.map((entry) => entry.elementId)).toEqual(['missing']);
    const removed = { ...fixed, layout: { root: 'root', structure: { root: ['bad', 'healthy'] } } };
    await render('design', removed);
    expect(outcomes.at(-1)).toEqual({ outcome: 'success', diagnostics: [] });
    // Switching page sessions cannot retain old failures.
    await render('run', removed);
    expect(outcomes.at(-1)).toEqual({ outcome: 'success', diagnostics: [] });

    // A merged application must aggregate layout/page errors even when their IDs match.
    const layout = createEmptyLayoutDocument('project_test');
    layout.schema = {
      ...schema,
      extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
      elements: {
        root: { type: 'container', props: {} },
        bad: { type: 'layout-broken', props: {} },
        outlet: { type: PAGE_OUTLET_TYPE, props: {} },
      },
      layout: { root: 'root', structure: { root: ['bad', 'outlet'] } },
    };
    let layoutBroken = true;
    const applicationMaterials = {
      ...materials,
      'layout-broken': () => {
        if (layoutBroken) throw new Error('layout failure');
        return <span>layout recovered</span>;
      },
    };
    const renderApplication = async (pageId: string) => {
      await act(async () =>
        root.render(
          <OrigamixApplicationPage
            pageId={pageId}
            schema={removed}
            layout={{ enabled: true, document: layout }}
            materials={applicationMaterials}
            onOutcome={onOutcome}
          />,
        ),
      );
    };
    broken = true;
    outcomes.length = 0;
    await renderApplication('page_one');
    expect(outcomes.every((entry) => entry.outcome === 'failed')).toBe(true);
    expect(
      outcomes
        .at(-1)
        ?.diagnostics.map(({ scope, elementId }) => `${scope}:${elementId}`)
        .sort(),
    ).toEqual(['layout:bad', 'page:bad']);
    layoutBroken = false;
    await retry('bad');
    expect(outcomes.at(-1)?.diagnostics.map(({ scope }) => scope)).toEqual(['page']);
    broken = false;
    await renderApplication('page_two');
    expect(outcomes.at(-1)).toEqual({ outcome: 'success', diagnostics: [] });
    expect(host.textContent).toContain('layout recovered');
    expect(host.textContent).toContain('recovered');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    errors.mockRestore();
  }
});
