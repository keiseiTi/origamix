import type { Rule } from 'eslint';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface BoundaryNode {
  type: string;
  value?: unknown;
  importKind?: string;
  exportKind?: string;
  source?: BoundaryNode | null;
  specifiers?: BoundaryNode[];
  moduleReference?: { expression?: BoundaryNode };
  callee?: BoundaryNode;
  arguments?: BoundaryNode[];
  name?: string;
  declaration?: { declarations?: BoundaryNode[] };
  id?: BoundaryNode;
  exported?: BoundaryNode;
}

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const normalize = (path: string) => path.replaceAll('\\', '/').replace(/\.(?:[cm]?[jt]sx?)$/, '');
const sourcePath = (path: string) => normalize(path).replace(/^src\//, '');
const owners = new Map([
  ['schema/revision-commit', ['schema/schema-service']],
  ['schema/working-schema-store', ['schema/schema-service', 'schema/revision-commit']],
  ['schema/target-schema-store', ['schema/project-apply-service']],
  [
    'infrastructure/atomic-file',
    [
      'projects/project-manifest-store',
      'projects/project-source',
      'projects/project-scaffold',
      'projects/project-upgrade-store',
      'projects/project-upgrade-service',
      'schema/working-schema-store',
      'schema/target-schema-store',
      'schema/project-apply-service',
    ],
  ],
]);
const business = /^(projects|schema|conversations|agent|diagnostics)\//;
const testOnly = /(^test\/|\.test$)/;
const typeOnly = (node: BoundaryNode) =>
  node.importKind === 'type' ||
  node.exportKind === 'type' ||
  (node.type === 'ImportDeclaration' &&
    (node.specifiers?.length ?? 0) > 0 &&
    node.specifiers?.every((specifier) => specifier.importKind === 'type'));

export const serverBoundaries: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary: '{{reason}}',
      literal: 'Use a literal module path so Server boundaries can be checked.',
    },
  },
  create(context) {
    const file = sourcePath(relative(serverRoot, context.filename));
    if (file.startsWith('../') || testOnly.test(file) || file.startsWith('scripts/')) return {};
    const report = (node: BoundaryNode, reason: string) =>
      context.report({
        node: node as unknown as Rule.Node,
        messageId: 'boundary',
        data: { reason },
      });
    const check = (source: BoundaryNode | null | undefined, node: BoundaryNode, isType = false) => {
      if (!source || typeof source.value !== 'string') {
        context.report({ node: node as unknown as Rule.Node, messageId: 'literal' });
        return;
      }
      const specifier = source.value;
      if (
        /^(electron|react|react-dom)(\/|$)/.test(specifier) ||
        /^@origamix\/(app|desktop)(\/|$)/.test(specifier)
      ) {
        report(node, 'Server cannot depend on Electron, React, App or Desktop.');
      }
      if (
        specifier.startsWith('@origamix/materials') &&
        !/^@origamix\/materials\/[^/]+\/manifest$/.test(specifier)
      ) {
        report(node, 'Server may import Materials manifests only.');
      }
      const thinBoundary = file.startsWith('http/') || file.startsWith('agent/tools/');
      if (
        thinBoundary &&
        /^(?:node:)?(?:fs(?:\/|$)|sqlite$|child_process$|module$)|^drizzle-orm(?:\/|$)|^better-sqlite3$/.test(
          specifier,
        )
      ) {
        report(
          node,
          'HTTP and Agent tools must use services instead of filesystem, database or module-loading APIs.',
        );
      }
      let target;
      if (specifier.startsWith('.'))
        target = sourcePath(relative(serverRoot, resolve(dirname(context.filename), specifier)));
      else if (specifier.startsWith('@origamix/server/'))
        target =
          (
            {
              runtime: 'server',
              utility: 'hosts/utility-process',
              template: 'templates/copy-template',
            } as Record<string, string>
          )[specifier.slice('@origamix/server/'.length)] ??
          sourcePath(specifier.slice('@origamix/server/'.length));
      else return;
      if (target.startsWith('../')) {
        report(
          node,
          'Use declared workspace package exports instead of relative imports outside Server.',
        );
        return;
      }
      if (
        !file.startsWith('evaluation/') &&
        file !== 'tooling' &&
        (target.startsWith('evaluation/') || target === 'tooling')
      ) {
        report(node, 'Runtime code cannot import evaluation modules or tooling.');
      }
      if (testOnly.test(target))
        report(node, 'Production modules cannot import testing helpers or tests.');
      if (
        business.test(file) &&
        (target.startsWith('http/') || ['server', 'hosts/utility-process'].includes(target))
      ) {
        report(node, 'Business modules cannot depend on HTTP or host startup.');
      }
      if (
        /^(database|infrastructure)\//.test(file) &&
        (business.test(target) ||
          target.startsWith('http/') ||
          ['server', 'hosts/utility-process'].includes(target))
      ) {
        report(node, 'Database and infrastructure cannot depend on business or transport modules.');
      }
      if (isType) return;
      if (thinBoundary) {
        const allowed = file.startsWith('http/')
          ? target.startsWith('http/') ||
            ['errors', 'schema/schema-service', 'schema/validation/schema-validation'].includes(
              target,
            )
          : target.startsWith('agent/tools/') ||
            [
              'errors',
              'agent/agent-engine',
              'schema/schema-service',
              'schema/validation/schema-validation',
              'schema/validation/material-validation',
            ].includes(target);
        if (!allowed)
          report(
            node,
            'HTTP and tools may use their local adapters and Schema service; other dependencies must be injected as narrow interfaces.',
          );
      }
      if (owners.has(target) && !owners.get(target)!.includes(file)) {
        report(node, `Only ${owners.get(target)!.join(', ')} may use ${target} at runtime.`);
      }
      if (thinBoundary && (target.startsWith('database/') || target.endsWith('-repository'))) {
        report(
          node,
          'HTTP and Agent tools receive narrow repository interfaces; do not construct repositories here.',
        );
      }
    };
    const checkExport = (node: BoundaryNode) => {
      if (node.source) check(node.source, node, typeOnly(node));
      if (file !== 'server') return;
      const declarations = node.declaration?.declarations ?? [];
      const names = [
        ...declarations.map((item) => item.id?.name),
        ...(node.specifiers ?? []).map((item) => item.exported?.name),
      ];
      if (
        node.source ||
        node.type !== 'ExportNamedDeclaration' ||
        !names.length ||
        names.some((name) => name !== 'startServer')
      ) {
        report(
          node,
          'src/server.ts exposes only the local startServer function; import internal modules directly.',
        );
      }
    };
    const listeners = {
      ImportDeclaration: (node: BoundaryNode) => check(node.source, node, typeOnly(node)),
      ImportExpression: (node: BoundaryNode) => check(node.source, node),
      TSImportEqualsDeclaration: (node: BoundaryNode) =>
        check(node.moduleReference?.expression, node, node.importKind === 'type'),
      CallExpression: (node: BoundaryNode) => {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'require')
          check(node.arguments?.[0], node);
      },
      ExportNamedDeclaration: checkExport,
      ExportAllDeclaration: checkExport,
      ExportDefaultDeclaration: checkExport,
    };
    return Object.fromEntries(
      Object.entries(listeners).map(([event, listener]) => [
        event,
        (node: Rule.Node) => listener(node as unknown as BoundaryNode),
      ]),
    );
  },
};
