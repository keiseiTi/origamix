import { nanoid } from 'nanoid';
import { useProjectSettingsSession } from './use-project-settings-session';
import { ProjectSettingsChat } from './project-settings-chat';
import { useState } from 'react';
import { EditorToolbar } from '@origamix/editor';
import { LayoutEffect } from './layout-effect';
import { type ProjectMenuItem } from '@origamix/shared';
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  Field,
  FieldLabel,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@origamix/ui';
import { ArrowUp, ArrowDown, Plus, Save, Trash2 } from 'lucide-react';
import { RoutingFields } from './routing-fields';

const Choice = ({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (value: string) => void;
}) => (
  <Field>
    <FieldLabel>{label}</FieldLabel>
    <Select value={value} items={items} onValueChange={(value) => onChange(value ?? '')}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

const AddMenuDialog = ({
  pages,
  parents,
  onAdd,
}: {
  pages: { value: string; label: string }[];
  parents: { value: string; label: string }[];
  onAdd: (item: ProjectMenuItem) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [pageId, setPageId] = useState('');
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [hidden, setHidden] = useState(false);
  const validPage = !pageId || pages.some((page) => page.value === pageId);
  const validParent = !parentId || parents.some((parent) => parent.value === parentId);
  const canAdd = validPage && validParent && Boolean(pageId || title.trim());
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPageId('');
          setTitle('');
          setParentId('');
          setHidden(false);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button size='sm' type='button' variant='outline' />}>
        <Plus size={14} />
        添加菜单
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            if (!canAdd) return;
            onAdd({
              id: nanoid(),
              title: title.trim(),
              pageId: pageId || undefined,
              parentId: parentId || undefined,
              hidden,
            });
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>添加菜单</DialogTitle>
          </DialogHeader>
          <Choice
            label='关联页面'
            value={pageId}
            items={[{ value: '', label: '仅作为分组' }, ...pages]}
            onChange={setPageId}
          />
          <Field>
            <FieldLabel htmlFor='new-menu-title'>菜单标题</FieldLabel>
            <Input
              id='new-menu-title'
              maxLength={80}
              required={!pageId}
              placeholder={pageId ? '留空跟随页面名称' : '输入分组名称'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Choice
            label='父级菜单'
            value={parentId}
            items={[{ value: '', label: '顶级菜单' }, ...parents]}
            onChange={setParentId}
          />
          <Field orientation='horizontal'>
            <Switch id='new-menu-hidden' checked={hidden} onCheckedChange={setHidden} />
            <FieldLabel htmlFor='new-menu-hidden'>隐藏菜单及子菜单</FieldLabel>
          </Field>
          {(!validPage || !validParent) && (
            <p role='alert' className='text-sm text-destructive'>
              页面或父级菜单已变化，请重新选择。
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type='button' variant='outline' />}>取消</DialogClose>
            <Button type='submit' disabled={!canAdd}>
              添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const ProjectSettingsPanel = ({
  projectId,
  onConfigureModel,
}: {
  projectId: string;
  onConfigureModel: () => void;
}) => {
  const session = useProjectSettingsSession(projectId);
  const { draft, setDraft, error, busy, saved, save } = session;
  const [selectedPage, setSelectedPage] = useState('');
  const [mode, setMode] = useState<'assistant' | 'form'>('assistant');
  const menu = draft?.shell.navigation ?? [];
  const updateMenu = (next: ProjectMenuItem[]) =>
    setDraft((current) => current && { ...current, shell: { ...current.shell, navigation: next } });
  const updateItem = (id: string, change: Partial<ProjectMenuItem>) =>
    updateMenu(menu.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const pageItems = [
    { value: '', label: '模板默认' },
    ...(draft?.pages ?? []).map((page) => ({ value: page.pageId, label: page.name })),
  ];
  const examplePages = [
    { pageId: 'page_example_home', name: '工作台' },
    { pageId: 'page_example_users', name: '用户管理' },
  ];
  const exampleMenu: ProjectMenuItem[] = [
    { id: 'example_home', title: '', pageId: 'page_example_home', hidden: false },
    { id: 'example_system', title: '系统管理', hidden: false },
    {
      id: 'example_users',
      parentId: 'example_system',
      title: '',
      pageId: 'page_example_users',
      hidden: false,
    },
  ];
  return (
    <section className='flex min-h-0 min-w-0 flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <EditorToolbar>
        <div className='min-w-0 flex-1'>
          {saved && !error && (
            <p role='status' className='text-muted-foreground'>
              配置已保存
            </p>
          )}
          {draft && error && (
            <p role='alert' className='truncate text-danger' title={error}>
              {error}
            </p>
          )}
        </div>
        <Button
          size='sm'
          variant='secondary'
          className='shrink-0 px-2 text-xs'
          aria-busy={busy}
          disabled={!draft || busy || session.running}
          onClick={() => void save()}
        >
          <Save size={14} />
          {busy ? '保存中…' : '保存配置'}
        </Button>
      </EditorToolbar>
      {!draft ? (
        <div className='grid justify-items-start gap-3 p-8'>
          {error ? (
            <>
              <p role='alert' className='text-sm text-destructive'>
                {error}
              </p>
              <Button variant='outline' onClick={session.reload}>
                重试读取
              </Button>
            </>
          ) : (
            <p role='status'>正在读取项目设置…</p>
          )}
        </div>
      ) : (
        <div className='grid min-h-0 flex-1 gap-4 overflow-auto p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden'>
          <div className='min-w-0 overflow-auto rounded-lg border border-border'>
            <LayoutEffect
              config={{ ...draft.shell, navigation: draft.shell.navigation ?? exampleMenu }}
              title={draft.name}
              enabled={
                draft.layout.enabled && !draft.shell.standalonePageIds.includes(selectedPage)
              }
              variant={draft.layout.initialVariant}
              pages={draft.shell.navigation === undefined ? examplePages : draft.pages}
              currentPageId={selectedPage}
              onNavigate={setSelectedPage}
            >
              <div className='grid min-h-72 place-content-center p-6 text-center font-medium'>
                {draft.pages.find((page) => page.pageId === selectedPage)?.name ??
                  examplePages.find((page) => page.pageId === selectedPage)?.name}
              </div>
            </LayoutEffect>
          </div>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === 'assistant' || value === 'form') setMode(value);
            }}
            className='min-h-0 min-w-0 gap-3'
          >
            <TabsList aria-label='布局配置方式'>
              <TabsTrigger value='assistant'>AI 助手</TabsTrigger>
              <TabsTrigger value='form'>表单配置</TabsTrigger>
            </TabsList>
            <TabsContent
              value='assistant'
              keepMounted
              className='min-h-96 flex-col not-data-hidden:flex lg:min-h-0'
            >
              <ProjectSettingsChat
                session={session}
                onConfigureModel={onConfigureModel}
                onViewChanges={() => setMode('form')}
              />
            </TabsContent>
            <TabsContent
              value='form'
              keepMounted
              render={<fieldset disabled={busy} />}
              className='content-start gap-5 overflow-y-auto pb-2 not-data-hidden:grid disabled:opacity-60'
            >
              {draft.layout.enabled && (
                <>
                  <div role='group' aria-label='布局样式' className='grid grid-cols-3 gap-2'>
                    {(
                      [
                        { value: 'side', label: '左右布局' },
                        { value: 'top', label: '顶部布局' },
                        { value: 'mix', label: '混合布局' },
                      ] as const
                    ).map((item) => (
                      <Button
                        key={item.value}
                        type='button'
                        variant={
                          draft.layout.initialVariant === item.value ? 'secondary' : 'outline'
                        }
                        aria-pressed={draft.layout.initialVariant === item.value}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            layout: { ...draft.layout, initialVariant: item.value },
                          })
                        }
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  <Field>
                    <FieldLabel htmlFor='shell-title'>标题</FieldLabel>
                    <Input
                      id='shell-title'
                      maxLength={80}
                      placeholder={draft.name}
                      value={draft.shell.title}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          shell: { ...draft.shell, title: event.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='shell-logo'>Logo 地址</FieldLabel>
                    <Input
                      id='shell-logo'
                      placeholder='/logo.png 或 https://…'
                      value={draft.shell.logo}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          shell: { ...draft.shell, logo: event.target.value },
                        })
                      }
                    />
                  </Field>
                  <section className='grid gap-3' aria-label='菜单配置'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-sm font-medium'>菜单配置</h3>
                      <AddMenuDialog
                        pages={pageItems.slice(1)}
                        parents={menu.map((item) => ({
                          value: item.id,
                          label:
                            item.title ||
                            draft.pages.find((page) => page.pageId === item.pageId)?.name ||
                            '未命名',
                        }))}
                        onAdd={(item) =>
                          setDraft(
                            (current) =>
                              current && {
                                ...current,
                                shell: {
                                  ...current.shell,
                                  navigation: [...(current.shell.navigation ?? []), item],
                                },
                              },
                          )
                        }
                      />
                    </div>
                    {draft.shell.navigation === undefined && (
                      <p className='text-xs text-muted-foreground'>
                        尚未配置。添加菜单后显示真实数据；示例菜单不会写入项目。
                      </p>
                    )}
                    {draft.shell.navigation?.length === 0 && (
                      <p className='text-xs text-muted-foreground'>
                        菜单为空，应用中不显示菜单项。
                      </p>
                    )}
                    {menu.map((item, index) => (
                      <div key={item.id} className='grid gap-3 rounded-lg border border-border p-3'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs text-muted-foreground'>菜单 {index + 1}</span>
                          <div className='flex gap-1'>
                            <Button
                              size='icon-xs'
                              variant='ghost'
                              type='button'
                              aria-label={`上移菜单 ${index + 1}`}
                              disabled={index === 0}
                              onClick={() => {
                                const next = [...menu];
                                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                                updateMenu(next);
                              }}
                            >
                              <ArrowUp size={14} />
                            </Button>
                            <Button
                              size='icon-xs'
                              variant='ghost'
                              type='button'
                              aria-label={`下移菜单 ${index + 1}`}
                              disabled={index === menu.length - 1}
                              onClick={() => {
                                const next = [...menu];
                                [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                                updateMenu(next);
                              }}
                            >
                              <ArrowDown size={14} />
                            </Button>
                            <Button
                              size='icon-xs'
                              variant='ghost'
                              type='button'
                              aria-label={`删除菜单 ${index + 1}`}
                              onClick={() => {
                                const removed = new Set([item.id]);
                                let changed = true;
                                while (changed) {
                                  changed = false;
                                  for (const candidate of menu)
                                    if (
                                      candidate.parentId &&
                                      removed.has(candidate.parentId) &&
                                      !removed.has(candidate.id)
                                    ) {
                                      removed.add(candidate.id);
                                      changed = true;
                                    }
                                }
                                updateMenu(menu.filter((candidate) => !removed.has(candidate.id)));
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        <Choice
                          label={`菜单 ${index + 1} 页面`}
                          value={item.pageId ?? ''}
                          items={[{ value: '', label: '仅作为分组' }, ...pageItems.slice(1)]}
                          onChange={(pageId) =>
                            updateItem(item.id, { pageId: pageId || undefined })
                          }
                        />
                        <Field>
                          <FieldLabel htmlFor={`menu-title-${item.id}`}>菜单标题</FieldLabel>
                          <Input
                            id={`menu-title-${item.id}`}
                            value={item.title}
                            maxLength={80}
                            placeholder='留空跟随页面名称'
                            onChange={(event) => updateItem(item.id, { title: event.target.value })}
                          />
                        </Field>
                        <Choice
                          label={`菜单 ${index + 1} 父级`}
                          value={item.parentId ?? ''}
                          items={[
                            { value: '', label: '顶级菜单' },
                            ...menu
                              .filter((candidate) => {
                                let parent: string | undefined = candidate.id;
                                const seen = new Set<string>();
                                while (parent && !seen.has(parent)) {
                                  if (parent === item.id) return false;
                                  seen.add(parent);
                                  parent = menu.find((node) => node.id === parent)?.parentId;
                                }
                                return true;
                              })
                              .map((candidate) => ({
                                value: candidate.id,
                                label:
                                  candidate.title ||
                                  draft.pages.find((page) => page.pageId === candidate.pageId)
                                    ?.name ||
                                  '未命名',
                              })),
                          ]}
                          onChange={(parentId) =>
                            updateItem(item.id, { parentId: parentId || undefined })
                          }
                        />
                        <Field orientation='horizontal'>
                          <Switch
                            id={`menu-hidden-${item.id}`}
                            checked={item.hidden}
                            onCheckedChange={(hidden) => updateItem(item.id, { hidden })}
                          />
                          <FieldLabel htmlFor={`menu-hidden-${item.id}`}>
                            隐藏菜单及子菜单
                          </FieldLabel>
                        </Field>
                      </div>
                    ))}
                  </section>
                </>
              )}
              <Choice
                label='首页'
                value={draft.shell.homePageId ?? ''}
                items={pageItems}
                onChange={(homePageId) =>
                  setDraft({
                    ...draft,
                    shell: { ...draft.shell, homePageId: homePageId || undefined },
                  })
                }
              />
              <Choice
                label='404 页面'
                value={draft.shell.notFoundPageId ?? ''}
                items={pageItems}
                onChange={(notFoundPageId) =>
                  setDraft({
                    ...draft,
                    shell: { ...draft.shell, notFoundPageId: notFoundPageId || undefined },
                  })
                }
              />
              <p className='text-xs text-muted-foreground'>
                未知地址保留原路径，显示指定页面；未选择时使用模板默认 404。
              </p>
              <section className='grid gap-2'>
                <h3 className='text-sm font-medium'>页面使用应用布局</h3>
                {!draft.pages.length && (
                  <p className='text-xs text-muted-foreground'>创建页面后可单独关闭页面布局。</p>
                )}
                {draft.pages.map((page) => (
                  <Field key={page.pageId} orientation='horizontal'>
                    <Switch
                      id={`page-layout-${page.pageId}`}
                      checked={!draft.shell.standalonePageIds.includes(page.pageId)}
                      onCheckedChange={(enabled) =>
                        setDraft({
                          ...draft,
                          shell: {
                            ...draft.shell,
                            standalonePageIds: enabled
                              ? draft.shell.standalonePageIds.filter((id) => id !== page.pageId)
                              : [...draft.shell.standalonePageIds, page.pageId],
                          },
                        })
                      }
                    />
                    <FieldLabel htmlFor={`page-layout-${page.pageId}`}>{page.name}</FieldLabel>
                    <Button
                      size='sm'
                      variant='ghost'
                      type='button'
                      onClick={() => setSelectedPage(page.pageId)}
                    >
                      查看效果
                    </Button>
                  </Field>
                ))}
              </section>
              <RoutingFields
                value={draft.routing}
                onChange={(routing) => setDraft({ ...draft, routing })}
                disabled={busy}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </section>
  );
};
