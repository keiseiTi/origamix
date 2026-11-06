import { useRef, useState } from 'react';
import { Tag } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@origamix/ui';
import {
  SYSTEM_PAGE_ROLES,
  type PageRoleState,
  type ProjectPageRoles,
  type UpdatePageRoles,
} from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { uniqueId } from '@/utils';

export const PageRoleSettings = ({
  projectId,
  pageId,
  pageName,
}: {
  projectId: string;
  pageId: string;
  pageName: string;
}) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PageRoleState | null>(null);
  const [draft, setDraft] = useState<ProjectPageRoles | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const pending = useRef<UpdatePageRoles | null>(null);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = await projectsService.pageRoles(projectId);
      setState(value);
      if (!pending.current) setDraft(structuredClone(value.roles));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取角色失败');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!state || !draft || busy) return;
    pending.current ??= {
      projectId,
      roles: draft,
      expectedManifestHash: state.manifestHash,
      clientRequestId: uniqueId(),
    };
    setUnconfirmed(true);
    setBusy(true);
    setError(null);
    try {
      const value = await projectsService.updatePageRoles(pending.current);
      pending.current = null;
      setUnconfirmed(false);
      setState(value);
      setDraft(structuredClone(value.roles));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存结果未确认，请重试或重新读取');
    } finally {
      setBusy(false);
    }
  };
  const selected =
    Object.entries(draft?.assignments ?? {}).find(([, assigned]) => assigned === pageId)?.[0] ??
    'none';
  const roles = [...SYSTEM_PAGE_ROLES, ...(draft?.definitions ?? [])];
  const assign = (roleId: string) => {
    if (!draft || pending.current) return;
    const assignments = Object.fromEntries(
      Object.entries(draft.assignments).filter(([, assigned]) => assigned !== pageId),
    );
    if (roleId !== 'none') assignments[roleId] = pageId;
    setDraft({ ...draft, assignments });
  };
  const replacements =
    state && draft
      ? Object.entries(state.roles.assignments)
          .filter(
            ([roleId, assigned]) => assigned !== pageId && draft.assignments[roleId] === pageId,
          )
          .map(
            ([roleId, assigned]) =>
              `${roles.find((role) => role.id === roleId)?.name ?? roleId}：${state.pages.find((page) => page.pageId === assigned)?.name ?? assigned} → ${pageName}`,
          )
      : [];
  return (
    <>
      <Button
        variant='ghost'
        size='icon-xs'
        aria-label={`${pageName} 页面角色`}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Tag size={13} />
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>页面角色 · {pageName}</DialogTitle>
            <DialogDescription>
              角色只标识页面用途，每个角色和页面一一对应。保存不会修改布局、页面内容或事件逻辑。
            </DialogDescription>
          </DialogHeader>
          {!state ? (
            <p className='text-sm'>{busy ? '正在读取…' : '无法读取页面角色'}</p>
          ) : (
            <>
              <label className='grid gap-2 text-sm'>
                页面角色
                <Select
                  value={selected}
                  disabled={busy || unconfirmed}
                  items={[
                    { value: 'none', label: '无角色' },
                    ...roles.map((role) => ({
                      value: role.id,
                      label: `${role.name}（${role.kind === 'system' ? '系统' : '自定义'}）`,
                    })),
                  ]}
                  onValueChange={(value) => value && assign(value)}
                >
                  <SelectTrigger aria-label='页面角色'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>无角色</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}（{role.kind === 'system' ? '系统' : '自定义'}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {replacements.map((text) => (
                <p key={text} className='text-sm text-muted-foreground'>
                  将替换关联：{text}
                </p>
              ))}
              <fieldset
                disabled={busy || unconfirmed}
                className='space-y-2 rounded border border-border p-3'
              >
                <legend className='text-sm'>自定义角色</legend>
                <label className='grid gap-1 text-sm'>
                  角色标识
                  <Input
                    value={id}
                    placeholder='例如 settings'
                    onChange={(event) => setId(event.target.value)}
                  />
                </label>
                <label className='grid gap-1 text-sm'>
                  角色名称
                  <Input
                    value={name}
                    placeholder='例如 设置页'
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    if (
                      !draft ||
                      !/^[a-z][a-z0-9-]{0,63}$/.test(id) ||
                      !name.trim() ||
                      roles.some((role) => role.id === id) ||
                      ['none', 'constructor', 'prototype'].includes(id)
                    ) {
                      setError('请输入不重复的有效角色标识及名称');
                      return;
                    }
                    setDraft({
                      ...draft,
                      definitions: [
                        ...draft.definitions,
                        { id, name: name.trim(), kind: 'custom' },
                      ],
                    });
                    setId('');
                    setName('');
                    setError(null);
                  }}
                >
                  添加角色
                </Button>
                {draft?.definitions.map((role) => (
                  <div className='flex items-center justify-between text-sm' key={role.id}>
                    <span>
                      {role.name} · {role.id}
                    </span>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() =>
                        setDraft({
                          ...draft,
                          definitions: draft.definitions.filter((item) => item.id !== role.id),
                          assignments: Object.fromEntries(
                            Object.entries(draft.assignments).filter(([key]) => key !== role.id),
                          ),
                        })
                      }
                    >
                      移除角色及关联
                    </Button>
                  </div>
                ))}
              </fieldset>
            </>
          )}
          {error && (
            <div role='alert' className='space-y-2 text-sm text-destructive'>
              <p>{error}</p>
              <Button
                size='sm'
                variant='outline'
                disabled={busy}
                onClick={() => {
                  pending.current = null;
                  setUnconfirmed(false);
                  void load();
                }}
              >
                重新读取配置
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' disabled={busy} onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={!state || busy} onClick={() => void save()}>
              {busy ? '处理中…' : unconfirmed ? '重试同一次保存' : '确认保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
