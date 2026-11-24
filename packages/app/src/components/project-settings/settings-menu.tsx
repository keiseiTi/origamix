import { ErrorToast } from '@/components/error-toast';
import { useState } from 'react';
import { nanoid } from 'nanoid';
import type { ProjectMenuItem, ProjectSettings } from '@origamix/shared';
import { ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';
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
} from '@origamix/ui';
import { SettingsChoice } from './settings-choice';

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
          <SettingsChoice
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
          <SettingsChoice
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
            <ErrorToast message='页面或父级菜单已变化，请重新选择。' />
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

export const SettingsMenu = ({
  navigation,
  pages: projectPages,
  onChange,
}: {
  navigation: ProjectMenuItem[] | undefined;
  pages: ProjectSettings['pages'];
  onChange: (navigation: ProjectMenuItem[]) => void;
}) => {
  const menu = navigation ?? [];
  const pages = projectPages.map((page) => ({ value: page.pageId, label: page.name }));
  const updateItem = (id: string, change: Partial<ProjectMenuItem>) =>
    onChange(menu.map((item) => (item.id === id ? { ...item, ...change } : item)));

  return (
    <section className='grid gap-3' aria-label='菜单配置'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium'>菜单配置</h3>
        <AddMenuDialog
          pages={pages}
          parents={menu.map((item) => ({
            value: item.id,
            label:
              item.title ||
              projectPages.find((page) => page.pageId === item.pageId)?.name ||
              '未命名',
          }))}
          onAdd={(item) => onChange([...menu, item])}
        />
      </div>
      {navigation === undefined && (
        <p className='text-xs text-muted-foreground'>
          尚未配置。添加菜单后显示真实数据；示例菜单不会写入项目。
        </p>
      )}
      {navigation?.length === 0 && (
        <p className='text-xs text-muted-foreground'>菜单为空，应用中不显示菜单项。</p>
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
                  onChange(next);
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
                  onChange(next);
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
                  onChange(menu.filter((candidate) => !removed.has(candidate.id)));
                }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
          <SettingsChoice
            label={`菜单 ${index + 1} 页面`}
            value={item.pageId ?? ''}
            items={[{ value: '', label: '仅作为分组' }, ...pages]}
            onChange={(pageId) => updateItem(item.id, { pageId: pageId || undefined })}
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
          <SettingsChoice
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
                    projectPages.find((page) => page.pageId === candidate.pageId)?.name ||
                    '未命名',
                })),
            ]}
            onChange={(parentId) => updateItem(item.id, { parentId: parentId || undefined })}
          />
          <Field orientation='horizontal'>
            <Switch
              id={`menu-hidden-${item.id}`}
              checked={item.hidden}
              onCheckedChange={(hidden) => updateItem(item.id, { hidden })}
            />
            <FieldLabel htmlFor={`menu-hidden-${item.id}`}>隐藏菜单及子菜单</FieldLabel>
          </Field>
        </div>
      ))}
    </section>
  );
};
