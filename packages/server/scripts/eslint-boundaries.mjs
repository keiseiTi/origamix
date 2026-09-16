import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = fileURLToPath(new URL('../', import.meta.url));
const normalize = (path) => path.replaceAll('\\', '/').replace(/\.(?:[cm]?[jt]sx?)$/, '');
const owners = new Map([
  ['schema/schema-commit', ['schema/schema-service']],
  ['schema/working-schema-store', ['schema/schema-service', 'schema/schema-commit']],
  ['schema/target-schema-store', ['schema/project-apply-service']],
  [
    'infrastructure/atomic-file',
    [
      'projects/project-manifest-store',
      'projects/project-source',
      'projects/project-scaffold',
      'schema/working-schema-store',
      'schema/target-schema-store',
      'schema/project-apply-service',
    ],
  ],
]);
const business = /^(projects|schema|conversations|agent|diagnostics)\//;
const testOnly = /(^testing\/|\.test$)/;
const typeOnly = (node) =>
  node.importKind === 'type' ||
  node.exportKind === 'type' ||
  (node.type === 'ImportDeclaration' &&
    node.specifiers.length > 0 &&
    node.specifiers.every((specifier) => specifier.importKind === 'type'));

export const serverBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary: '{{reason}}',
      literal: 'Use a literal module path so Server boundaries can be checked.',
    },
  },
  create(context) {
    const file = normalize(relative(serverRoot, context.filename));
    if (file.startsWith('../') || testOnly.test(file) || file.startsWith('scripts/')) return {};
    const report = (node, reason) =>
      context.report({ node, messageId: 'boundary', data: { reason } });
    const check = (source, node, isType = false) => {
      if (!source || typeof source.value !== 'string') {
        context.report({ node, messageId: 'literal' });
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
        !/^@origamix\/materials\/(?:manifest|[^/]+\/manifest)$/.test(specifier)
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
        target = normalize(relative(serverRoot, resolve(dirname(context.filename), specifier)));
      else if (specifier.startsWith('@origamix/server/'))
        target = normalize(specifier.slice('@origamix/server/'.length));
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
        (target.startsWith('http/') || ['runtime', 'index'].includes(target))
      ) {
        report(node, 'Business modules cannot depend on HTTP or host startup.');
      }
      if (
        /^(database|infrastructure)\//.test(file) &&
        (business.test(target) ||
          target.startsWith('http/') ||
          ['runtime', 'index'].includes(target))
      ) {
        report(node, 'Database and infrastructure cannot depend on business or transport modules.');
      }
      if (isType) return;
      if (thinBoundary) {
        const allowed = file.startsWith('http/')
          ? target.startsWith('http/') || ['errors', 'schema/schema-service'].includes(target)
          : target.startsWith('agent/tools/') ||
            [
              'errors',
              'agent/engine',
              'schema/schema-service',
              'schema/material-validation',
            ].includes(target);
        if (!allowed)
          report(
            node,
            'HTTP and tools may use their local adapters and Schema service; other dependencies must be injected as narrow interfaces.',
          );
      }
      if (owners.has(target) && !owners.get(target).includes(file)) {
        report(node, `Only ${owners.get(target).join(', ')} may use ${target} at runtime.`);
      }
      if (thinBoundary && (target.startsWith('database/') || target.endsWith('-repository'))) {
        report(
          node,
          'HTTP and Agent tools receive narrow repository interfaces; do not construct repositories here.',
        );
      }
    };
    const checkExport = (node) => {
      if (node.source) check(node.source, node, typeOnly(node));
      if (file !== 'runtime') return;
      const declarations = node.declaration?.declarations ?? [];
      const names = [
        ...declarations.map((item) => item.id.name),
        ...(node.specifiers ?? []).map((item) => item.exported.name),
      ];
      if (
        node.source ||
        node.type !== 'ExportNamedDeclaration' ||
        !names.length ||
        names.some((name) => name !== 'startServer')
      ) {
        report(
          node,
          'runtime.ts exposes only the local startServer function; import internal modules directly.',
        );
      }
    };
    return {
      ImportDeclaration: (node) => check(node.source, node, typeOnly(node)),
      ImportExpression: (node) => check(node.source, node),
      TSImportEqualsDeclaration: (node) =>
        check(node.moduleReference.expression, node, node.importKind === 'type'),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require')
          check(node.arguments[0], node);
      },
      ExportNamedDeclaration: checkExport,
      ExportAllDeclaration: checkExport,
      ExportDefaultDeclaration: checkExport,
    };
  },
};
