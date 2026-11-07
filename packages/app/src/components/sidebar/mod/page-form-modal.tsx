import { useEffect, useRef, useState } from 'react';
import { SYSTEM_PAGE_ROLES, type PageRoleState, type UpdatePageRoles } from '@origamix/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '@origamix/ui';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { projectsService } from '@/services/projects';
import { PageRoleField, type PageRoleSelection } from '@/components/page-role/page-role-field';
import { uniqueId } from '@/utils';

export const PageFormModal = ({
  projectId,
  page,
  onClose,
  onCreated,
}: {
  projectId: string;
  page?: PageItem;
  onClose: () => void;
  onCreated: (projectId: string, page: PageItem) => void;
}): React.JSX.Element => {
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const pageId = page?.id;
  const [name, setName] = useState(page?.name ?? '');
  const [slug, setSlug] = useState('');
  const [role, setRole] = useState<PageRoleSelection>('none');
  const [state, setState] = useState<PageRoleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const pending = useRef<UpdatePageRoles | null>(null);
  useEffect(() => {
    let current = true;
    void projectsService
      .pageRoles(projectId)
      .then((value) => {
        if (!current) return;
        setState(value);
        setRole(
          (pageId
            ? SYSTEM_PAGE_ROLES.find((role) => value.roles.assignments[role.id] === pageId)?.id
            : undefined) ?? 'none',
        );
        setError(null);
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : '无法读取页面角色');
      });
    return () => {
      current = false;
    };
  }, [projectId, pageId, attempt]);
  const submit = async () => {
    if (!state || busy) return;
    if (!name.trim() || (!page && !slug.trim())) return setError('请填写页面名称和页面标识。');
    setBusy(true);
    setError(null);
    try {
      if (page) {
        const assignments = Object.fromEntries(
          Object.entries(state.roles.assignments).filter(([, id]) => id !== page.id),
        );
        if (role !== 'none') assignments[role] = page.id;
        pending.current ??= {
          projectId,
          roles: { assignments },
          page: { pageId: page.id, name: name.trim() },
          expectedManifestHash: state.manifestHash,
          clientRequestId: uniqueId(),
        };
        setUnconfirmed(true);
        const result = await projectsService.updatePageRoles(pending.current);
        const saved = result.pages.find((item) => item.pageId === page.id);
        setProjects((projects) =>
          projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  pages: project.pages.map((item) =>
                    item.id === page.id ? { ...item, name: saved?.name ?? item.name } : item,
                  ),
                }
              : project,
          ),
        );
        pending.current = null;
      } else {
        setUnconfirmed(true);
        const created = await projectsService.createPage(projectId, {
          name: name.trim(),
          slug: slug.trim(),
          ...(role === 'none' ? {} : { role }),
          expectedManifestHash: state.manifestHash,
        });
        onCreated(projectId, { id: created.id, name: created.name, fileName: created.slug });
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试或重新读取');
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    setBusy(true);
    try {
      const pages = await projectsService.pages(projectId);
      setProjects((projects) =>
        projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                pages: pages.map((item) => ({ id: item.id, name: item.name, fileName: item.slug })),
              }
            : project,
        ),
      );
      pending.current = null;
      setUnconfirmed(false);
      setState(null);
      setAttempt((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重新读取失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{page ? '编辑页面' : '新建页面'}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor='page-name'>页面名称</FieldLabel>
            <Input
              id='page-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy || unconfirmed}
              maxLength={80}
              required
              autoFocus
            />
          </Field>
          {!page && (
            <Field>
              <FieldLabel htmlFor='page-slug'>页面标识</FieldLabel>
              <Input
                id='page-slug'
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                disabled={busy || unconfirmed}
                placeholder='例如：customer-list'
                required
              />
            </Field>
          )}
          {state ? (
            <PageRoleField
              value={role}
              onChange={setRole}
              state={state}
              pageId={page?.id}
              disabled={busy || unconfirmed}
            />
          ) : (
            <p className='text-sm text-muted-foreground'>
              {error ? '无法读取页面角色' : '正在读取页面角色…'}
            </p>
          )}
          {error && (
            <div role='alert' className='space-y-2 text-sm text-destructive'>
              <p>{error}</p>
              {unconfirmed && <p>请先重新读取确认保存结果；编辑页面也可以重试同一次保存。</p>}
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => void reload()}
              >
                重新读取配置
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              取消
            </Button>
            <Button type='submit' disabled={busy || !state || (!page && unconfirmed)}>
              {busy
                ? '处理中…'
                : unconfirmed && page
                  ? '重试同一次保存'
                  : page
                    ? '保存'
                    : '创建页面'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
