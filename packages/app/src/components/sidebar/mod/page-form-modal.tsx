import { ErrorToast } from '@/components/error-toast';
import { useEffect, useState } from 'react';
import { SYSTEM_PAGE_ROLES, type PageRoleState } from '@origamix/shared';
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
  toast,
} from '@origamix/ui';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { projectsService } from '@/services/projects';
import { PageRoleField, type PageRoleSelection } from '@/components/page-role/page-role-field';

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
  }, [projectId, pageId]);

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
        const result = await projectsService.updatePageRoles({
          projectId,
          roles: { assignments },
          page: { pageId: page.id, name: name.trim() },
        });
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
      } else {
        const created = await projectsService.createPage(projectId, {
          name: name.trim(),
          slug: slug.trim(),
          ...(role === 'none' ? {} : { role }),
        });
        onCreated(projectId, { id: created.id, name: created.name, fileName: created.slug });
      }
      onClose();
    } catch (reason) {
      if (page) {
        setError(reason instanceof Error ? reason.message : '保存失败，请重试');
      } else {
        toast.add({
          title: reason instanceof Error ? reason.message : '创建页面失败',
          type: 'error',
        });
      }
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
              disabled={busy}
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
                disabled={busy}
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
              disabled={busy}
            />
          ) : (
            <p className='text-sm text-muted-foreground'>
              {error ? '无法读取页面角色' : '正在读取页面角色…'}
            </p>
          )}
          {error && <ErrorToast message={error} />}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              取消
            </Button>
            <Button type='submit' disabled={busy || !state}>
              {busy ? '处理中…' : page ? '保存' : '创建页面'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
