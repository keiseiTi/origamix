import { ErrorToast } from '@/components/error-toast';
import { useProjectSettingsSession } from './use-project-settings-session';
import { useState } from 'react';
import { EditorToolbar } from '@origamix/editor';
import { LayoutEffect } from './layout-effect';
import { type ProjectMenuItem } from '@origamix/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  FieldLabel,
  Input,
  Switch,
} from '@origamix/ui';
import { Save } from 'lucide-react';
import { SettingsChoice } from './settings-choice';
import { SettingsMenu } from './settings-menu';
import { RoutingFields } from './routing-fields';

export const ProjectSettingsPanel = ({ projectId }: { projectId: string }) => {
  const session = useProjectSettingsSession(projectId);
  const { draft, setDraft, error, busy, saved, save } = session;
  const [selectedPage, setSelectedPage] = useState('');
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
          {draft && error && <ErrorToast message={error} />}
        </div>
        {draft && session.stale && (
          <Button
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={() => void session.reviewLatest()}
          >
            读取最新配置并核对草稿
          </Button>
        )}
        <Button
          size='sm'
          variant='secondary'
          className='shrink-0 px-2 text-xs'
          aria-busy={busy}
          disabled={!draft || busy || session.stale}
          onClick={() => void save()}
        >
          <Save size={14} />
          {busy ? '保存中…' : '保存配置'}
        </Button>
      </EditorToolbar>
      {session.latest && session.conflicts && draft && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) session.dismissReview();
          }}
        >
          <DialogContent className='max-h-[85vh] overflow-auto sm:max-w-3xl'>
            <DialogHeader>
              <DialogTitle>核对项目配置冲突</DialogTitle>
            </DialogHeader>
            <p>
              以下设置在两边都已修改：{session.conflicts.join('、')}
              。其余修改会合并到草稿，核对后再保存。
            </p>
            <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
              {[
                { label: '我的草稿', value: draft },
                { label: '项目最新配置', value: session.latest },
              ].map(({ label, value }) => (
                <div key={label} className='min-w-0'>
                  <p className='mb-2 font-medium'>{label}</p>
                  <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs'>
                    {JSON.stringify(
                      { shell: value.shell, layout: value.layout, routing: value.routing },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={session.dismissReview}>
                稍后核对
              </Button>
              <Button variant='outline' onClick={() => session.resolveReview(false)}>
                冲突项使用最新配置
              </Button>
              <Button onClick={() => session.resolveReview(true)}>冲突项保留我的草稿</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {!draft ? (
        <div className='grid justify-items-start gap-3 p-8'>
          {error ? (
            <>
              <ErrorToast message={error} />
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
          <fieldset
            disabled={busy}
            className='grid min-h-0 min-w-0 content-start gap-5 overflow-y-auto pb-2 disabled:opacity-60'
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
                      variant={draft.layout.initialVariant === item.value ? 'secondary' : 'outline'}
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
                <SettingsMenu
                  navigation={draft.shell.navigation}
                  pages={draft.pages}
                  onChange={(navigation) =>
                    setDraft(
                      (current) =>
                        current && { ...current, shell: { ...current.shell, navigation } },
                    )
                  }
                />
              </>
            )}
            <SettingsChoice
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
            <SettingsChoice
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
          </fieldset>
        </div>
      )}
    </section>
  );
};
