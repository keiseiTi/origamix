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
  Switch,
} from '@origamix/ui';
import type { ProjectSettings } from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { projectSettingsTabId, useWorkspaceStore } from '@/store/workspace';

export const EditProjectModal = ({
  projectId,
  initialName,
  onClose,
}: {
  projectId: string;
  initialName: string;
  onClose: () => void;
}) => {
  const [name, setName] = useState(initialName);
  const [settings, setSettings] = useState<ProjectSettings>();
  const [external, setExternal] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const info = await projectsService.navigation(projectId);
        if (info.runtime === 'external') {
          if (current) setExternal(true);
          return;
        }
        const next = await projectsService.settings(projectId);
        if (current) {
          setSettings(next);
          setName(next.name);
          setEnabled(next.layout.enabled);
        }
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : '读取项目失败');
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [projectId, attempt]);
  const save = async () => {
    if (busy || (!settings && !external)) return;
    setBusy(true);
    setError(undefined);
    try {
      const updated = settings
        ? await projectsService.updateSettings({
            projectId,
            name: name.trim(),
            expectedManifestHash: settings.manifestHash,
            shell: settings.shell,
            routing: settings.routing,
            layout: { ...settings.layout, enabled },
          })
        : await projectsService.rename(projectId, name.trim());
      const store = useWorkspaceStore.getState();
      if (!enabled) store.removePages([projectSettingsTabId(projectId)]);
      store.setProjects((projects) =>
        projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                name: updated.name,
                runtime: external ? 'external' : 'origamix',
                layoutEnabled: enabled,
              }
            : project,
        ),
      );
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
    } finally {
      setBusy(false);
    }
  };
  const loaded = Boolean(settings || external);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor='edit-project-name'>项目名称</FieldLabel>
            <Input
              id='edit-project-name'
              value={name}
              maxLength={80}
              disabled={!loaded || busy}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </Field>
          {!loaded && (
            <p role='status' className='text-sm text-muted-foreground'>
              {error ? '无法读取项目配置' : '正在读取项目配置…'}
            </p>
          )}
          {settings && (
            <>
              <Field orientation='horizontal'>
                <Switch
                  id='edit-project-layout'
                  checked={enabled}
                  disabled={busy}
                  onCheckedChange={setEnabled}
                />
                <FieldLabel htmlFor='edit-project-layout'>启用布局配置</FieldLabel>
              </Field>
              <p className='text-xs text-muted-foreground'>
                启用后，点击项目下的“布局配置”设置布局、品牌、菜单和页面规则。关闭后保留配置内容。
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
            {!loaded && error && (
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setError(undefined);
                  setAttempt((value) => value + 1);
                }}
              >
                重试读取
              </Button>
            )}
            <Button type='submit' disabled={!loaded || busy}>
              {busy ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
