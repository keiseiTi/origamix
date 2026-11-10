import { useEffect, useState } from 'react';
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
  Textarea,
  Switch,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@origamix/ui';
import {
  applicationIssue,
  type ProjectApplicationSettings,
  type ProjectAccess,
} from '@origamix/shared';
import { projectsService } from '@/services/projects';
export const ApplicationDialog = ({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) => {
  const [state, setState] = useState<ProjectApplicationSettings>(),
    [initial, setInitial] = useState('{}'),
    [enabled, setEnabled] = useState(false);
  const [access, setAccess] = useState<Extract<ProjectAccess, { enabled: true }>>({
    enabled: true,
    loginPageId: '',
    homePageId: '',
    publicPageIds: [],
    stateKey: 'authenticated',
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    projectsService
      .application(projectId)
      .then((next) => {
        if (current) {
          setState(next);
          setInitial(JSON.stringify(next.initialState, null, 2));
          setEnabled(next.access.enabled);
          if (next.access.enabled) setAccess(next.access);
        }
      })
      .catch((reason) => {
        if (current) setError(reason instanceof Error ? reason.message : '读取应用配置失败');
      });
    return () => {
      current = false;
    };
  }, [projectId, attempt]);
  const save = async () => {
    if (!state || busy) return;
    let initialState: Record<string, unknown>;
    try {
      initialState = JSON.parse(initial);
      const issue = applicationIssue(
        { initialState, access: enabled ? access : { enabled: false } },
        state.pages,
        state.runtime,
      );
      if (issue) throw new Error(issue);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '初始状态必须是 JSON 对象');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await projectsService.updateApplication({
        projectId,
        expectedManifestHash: state.manifestHash,
        initialState,
        access: enabled ? access : { enabled: false },
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className='max-h-[85vh] overflow-y-auto'>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>应用状态与访问规则</DialogTitle>
          </DialogHeader>
          {!state ? (
            <p role='status'>正在读取应用配置…</p>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor='application-initial'>应用初始状态（JSON）</FieldLabel>
                <Textarea
                  id='application-initial'
                  className='min-h-36 font-mono'
                  value={initial}
                  disabled={busy}
                  onChange={(event) => setInitial(event.target.value)}
                  placeholder={'{ "authenticated": false, "user": null }'}
                />
                <p className='text-xs text-muted-foreground'>
                  所有页面共享当前应用会话内的状态。刷新时恢复初始值；恢复会话、接口请求、失败处理由页面初始化事件和逻辑流配置。不要填写密码或
                  Token 等秘密。
                </p>
              </Field>
              <Field orientation='horizontal'>
                <Switch
                  id='application-access'
                  checked={enabled}
                  disabled={busy}
                  onCheckedChange={(checked) => {
                    setEnabled(checked);
                    if (checked && initial.trim() === '{}')
                      setInitial('{\n  "authenticated": false,\n  "user": null\n}');
                  }}
                />
                <FieldLabel htmlFor='application-access'>启用登录访问规则</FieldLabel>
              </Field>
              {enabled && (
                <>
                  {(['loginPageId', 'homePageId'] as const).map((field) => (
                    <Field key={field}>
                      <FieldLabel>{field === 'loginPageId' ? '登录页' : '默认首页'}</FieldLabel>
                      <Select
                        value={access[field]}
                        disabled={busy}
                        items={state.pages.map((page) => ({
                          value: page.pageId,
                          label: page.name,
                        }))}
                        onValueChange={(id) => id && setAccess({ ...access, [field]: id })}
                      >
                        <SelectTrigger aria-label={field === 'loginPageId' ? '登录页' : '默认首页'}>
                          <SelectValue placeholder='选择页面' />
                        </SelectTrigger>
                        <SelectContent>
                          {state.pages.map((page) => (
                            <SelectItem key={page.pageId} value={page.pageId}>
                              {page.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ))}
                  <Field>
                    <FieldLabel htmlFor='application-state-key'>访问状态字段</FieldLabel>
                    <Input
                      id='application-state-key'
                      value={access.stateKey}
                      disabled={busy}
                      required
                      onChange={(event) => setAccess({ ...access, stateKey: event.target.value })}
                    />
                    <p className='text-xs text-muted-foreground'>
                      必须是初始状态中声明的布尔字段。true 允许进入受限页面；false
                      进入登录页。登录成功与否由逻辑流判断并更新此字段。
                    </p>
                  </Field>
                  <fieldset className='grid gap-2'>
                    <legend className='mb-2 text-sm font-medium'>公开页面</legend>
                    <p className='text-xs text-muted-foreground'>
                      登录页自动公开且不使用应用布局；其余未勾选页面受访问规则保护。
                    </p>
                    {state.pages
                      .filter((page) => page.pageId !== access.loginPageId)
                      .map((page) => (
                        <Field orientation='horizontal' key={page.pageId}>
                          <Checkbox
                            id={`public-${page.pageId}`}
                            checked={access.publicPageIds.includes(page.pageId)}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                              setAccess({
                                ...access,
                                publicPageIds: checked
                                  ? [...access.publicPageIds, page.pageId]
                                  : access.publicPageIds.filter((id) => id !== page.pageId),
                              })
                            }
                          />
                          <FieldLabel htmlFor={`public-${page.pageId}`}>{page.name}</FieldLabel>
                        </Field>
                      ))}
                  </fieldset>
                </>
              )}
              <p className='text-xs text-muted-foreground'>
                使用普通表单、按钮和事件逻辑流编排业务。接口 Cookie
                携带方式由请求节点显式配置；平台不自动检查会话、处理 401 或添加登录、退出控件。
              </p>
            </>
          )}
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              取消
            </Button>
            {!state && error && (
              <Button
                type='button'
                onClick={() => {
                  setError(undefined);
                  setAttempt((v) => v + 1);
                }}
              >
                重试读取
              </Button>
            )}
            <Button type='submit' disabled={!state || busy}>
              {busy ? '保存中…' : '保存应用配置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
