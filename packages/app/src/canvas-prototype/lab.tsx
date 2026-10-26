import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Button, Input, FieldLabel } from '@origamix/ui';
import {
  deriveSchemaOperations,
  type CanvasPrototypeCommand,
  type CanvasPrototypeSnapshot,
} from '@origamix/editor';
import { validatePage, type OrigamixPageSchema } from '@origamix/shared';
import { Moon, Sun, RotateCcw, Undo2, Redo2, MousePointer2 } from 'lucide-react';
import frameDocument from 'virtual:canvas-prototype-document';
import { isReply, type Scope, type Request } from './protocol';
import { sample } from './sample';

const Session = ({
  initial,
  onSnapshot,
}: {
  initial: OrigamixPageSchema;
  onSnapshot: (snapshot: CanvasPrototypeSnapshot) => void;
}) => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | null>(null);
  const current = useRef({ version: 0, command: 0 });
  const [scope] = useState<Scope>(() => ({
    protocol: 1,
    instanceId: crypto.randomUUID(),
    projectId: 'prototype',
    pageId: 'sample',
  }));
  const [nonce] = useState(() => crypto.randomUUID());
  const [localVersion, setLocalVersion] = useState(0);
  const timeoutRef = useRef<number | undefined>(undefined);
  const latest = useRef<CanvasPrototypeSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<CanvasPrototypeSnapshot | null>(null);
  const [width, setWidth] = useState(800);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<{ type: string; x: number; y: number } | null>(null);
  const notify = useRef(onSnapshot);
  useEffect(() => {
    notify.current = onSnapshot;
  }, [onSnapshot]);
  const send = useCallback(
    (command: CanvasPrototypeCommand) => {
      if (!port.current) return;
      const state = current.current;
      const message: Request = {
        ...scope,
        commandId: ++state.command,
        version: state.version,
        command,
      };
      port.current.postMessage(message);
    },
    [scope],
  );
  const cancel = useCallback(() => {
    drag.current = null;
    setDragging(null);
    send({ kind: 'cancel' });
  }, [send]);
  useEffect(() => {
    const blur = () => cancel();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('blur', blur);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('keydown', key);
      port.current?.close();
      port.current = null;
      clearTimeout(timeoutRef.current);
    };
  }, [cancel]);
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const move = () => {
      const active = drag.current,
        bounds = iframe.current?.getBoundingClientRect();
      if (active && bounds) {
        const x = active.x - bounds.left,
          y = active.y - bounds.top;
        if (x >= 0 && y >= 0 && x < bounds.width && y < bounds.height)
          send({ kind: 'hover', x, y });
        else send({ kind: 'cancel' });
      }
      frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => cancelAnimationFrame(frame);
  }, [dragging, send]);
  const initialize = () => {
    port.current?.close();
    current.current = { version: 0, command: 0 };
    setReady(false);
    const channel = new MessageChannel();
    port.current = channel.port1;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(
      () => setError('画布未能初始化。请恢复画布，已接收的快照仍保留。'),
      15000,
    );
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      if (port.current !== channel.port1 || !isReply(event.data, scope)) return;
      const message = event.data;
      if (message.commandId > current.current.command) return;
      if (message.kind === 'error') {
        setError(message.message);
        return;
      }
      if (
        message.version < current.current.version ||
        message.version > current.current.version + 1 ||
        !validatePage(message.snapshot.schema).valid
      )
        return;
      clearTimeout(timeoutRef.current);
      current.current.version = message.version;
      setReady(true);
      setLocalVersion(message.version);
      latest.current = message.snapshot;
      setSnapshot(message.snapshot);
      setError('');
      notify.current(message.snapshot);
    };
    channel.port1.start();
    iframe.current?.contentWindow?.postMessage(
      { kind: 'prototype.initialize', scope, schema: latest.current?.schema ?? initial },
      '*',
      [channel.port2],
    );
  };
  const selected = snapshot?.selectedId ? snapshot.schema.elements[snapshot.selectedId] : undefined;
  const field =
    selected?.type === 'button' ? 'text' : selected?.type === 'input' ? 'placeholder' : null;
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, type: string) => {
    if (!ready || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { type, x: event.clientX, y: event.clientY };
    setDragging(type);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current,
      bounds = iframe.current?.getBoundingClientRect();
    drag.current = null;
    setDragging(null);
    if (active && bounds) {
      const x = event.clientX - bounds.left,
        y = event.clientY - bounds.top;
      if (x >= 0 && y >= 0 && x < bounds.width && y < bounds.height)
        send({ kind: 'add', materialType: active.type, x, y });
      else send({ kind: 'cancel' });
    }
  };
  return (
    <>
      <div className='flex flex-wrap items-center gap-2 border-b p-3'>
        <Button
          size='sm'
          variant='outline'
          disabled={!ready || !snapshot?.canUndo}
          onClick={() => send({ kind: 'undo' })}
        >
          <Undo2 />
          撤销
        </Button>
        <Button
          size='sm'
          variant='outline'
          disabled={!ready || !snapshot?.canRedo}
          onClick={() => send({ kind: 'redo' })}
        >
          <Redo2 />
          重做
        </Button>
        <FieldLabel htmlFor='prototype-width'>画布宽度</FieldLabel>
        <Input
          id='prototype-width'
          className='w-24'
          type='number'
          min={360}
          max={1200}
          value={width}
          onChange={(event) =>
            setWidth(Math.max(360, Math.min(1200, Number(event.target.value) || 360)))
          }
        />
        <span role='status' className='text-xs text-muted-foreground'>
          {ready ? `已连接 · 局部版本 ${localVersion}` : '正在启动隔离画布…'}
        </span>
      </div>
      {error && (
        <p role='alert' className='border-b p-3 text-sm text-destructive'>
          {error}
        </p>
      )}
      <div className='grid min-h-0 flex-1 grid-cols-[160px_minmax(0,1fr)_240px]'>
        <aside className='space-y-3 border-r p-3' aria-label='原型物料'>
          <h2 className='text-sm font-medium'>拖入物料</h2>
          <p className='text-xs text-muted-foreground'>
            拖到画布，或聚焦后按回车添加。输入框需放入表单。
          </p>
          {(['button', 'input'] as const).map((type) => (
            <button
              key={type}
              disabled={!ready}
              className='w-full touch-none rounded-md border p-3 text-sm hover:bg-muted focus-visible:outline-2 disabled:opacity-40'
              onPointerDown={(event) => pointerDown(event, type)}
              onPointerMove={(event) => {
                if (drag.current) {
                  drag.current.x = event.clientX;
                  drag.current.y = event.clientY;
                }
              }}
              onPointerUp={pointerUp}
              onPointerCancel={cancel}
              onLostPointerCapture={cancel}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  send({ kind: 'add', materialType: type, x: 70, y: type === 'input' ? 64 : 120 });
                }
              }}
            >
              {type === 'button' ? '按钮' : '输入框'}
            </button>
          ))}
        </aside>
        <main className='min-h-0 overflow-auto bg-muted/40 p-4' aria-label='画布区域'>
          <iframe
            ref={iframe}
            title='隔离画布原型'
            sandbox='allow-scripts'
            referrerPolicy='no-referrer'
            srcDoc={frameDocument.replaceAll('__CANVAS_NONCE__', nonce)}
            className={`mx-auto h-full min-h-96 border-0 bg-white shadow-sm ${dragging ? 'pointer-events-none' : ''}`}
            style={{ width, maxWidth: '100%' }}
            onLoad={initialize}
          />
        </main>
        <aside className='space-y-3 overflow-auto border-l p-3' aria-label='宿主属性面板'>
          <h2 className='text-sm font-medium'>选中与属性</h2>
          <p className='break-all text-xs text-muted-foreground'>
            {snapshot?.selectedId ?? '点击画布元素进行选择'}
          </p>
          {field && snapshot?.selectedId && (
            <form
              key={`${snapshot.selectedId}:${String(selected?.props[field])}`}
              className='space-y-2'
              onSubmit={(event) => {
                event.preventDefault();
                send({
                  kind: 'update',
                  id: snapshot.selectedId!,
                  field,
                  value: String(new FormData(event.currentTarget).get('value') ?? ''),
                });
              }}
            >
              <FieldLabel htmlFor='prototype-value'>
                {field === 'text' ? '按钮文本' : '输入提示'}
              </FieldLabel>
              <Input
                id='prototype-value'
                defaultValue={String(selected?.props[field] ?? '')}
                maxLength={1000}
                name='value'
              />
              <Button size='sm' type='submit'>
                更新画布
              </Button>
            </form>
          )}
          <p className='text-xs text-muted-foreground'>
            页面使用自己的默认主题。宿主变为深色时，画布保持浅色。
          </p>
          <p className='text-xs text-muted-foreground'>
            通过元素上方的移动手柄调整位置。输入框内的撤销保留浏览器行为。
          </p>
        </aside>
      </div>
      {dragging && (
        <div className='pointer-events-none fixed bottom-4 left-1/2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg'>
          正在拖入{dragging === 'button' ? '按钮' : '输入框'} · Esc 取消
        </div>
      )}
    </>
  );
};
export const CanvasPrototypeLab = () => {
  const [dark, setDark] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [initial, setInitial] = useState(sample);
  const [snapshot, setSnapshot] = useState<CanvasPrototypeSnapshot | null>(null);
  const operations = useMemo(
    () => (snapshot ? deriveSchemaOperations(sample, snapshot.schema) : []),
    [snapshot],
  );
  return (
    <div
      className={`${dark ? 'dark ' : ''}origamix-ui flex h-screen flex-col bg-background text-foreground`}
    >
      <header className='flex items-center gap-3 border-b p-3'>
        <MousePointer2 className='size-5' />
        <div className='flex-1'>
          <h1 className='text-sm font-semibold'>画布隔离原型</h1>
          <p className='text-xs text-muted-foreground'>
            独立试验页 · 使用示例数据 · 不保存到真实项目
          </p>
        </div>
        <Button size='sm' variant='outline' onClick={() => setDark(!dark)}>
          {dark ? <Sun /> : <Moon />}切换宿主主题
        </Button>
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            setInitial(snapshot?.schema ?? sample);
            setGeneration(generation + 1);
          }}
        >
          <RotateCcw />
          恢复画布
        </Button>
      </header>
      <Session key={generation} initial={initial} onSnapshot={setSnapshot} />
      <details className='max-h-48 overflow-auto border-t p-3 text-xs'>
        <summary className='cursor-pointer'>
          编辑差异：{operations?.length ?? '完整候选'} 项（仅验证现有 Operation 转换，不提交）
        </summary>
        <pre className='whitespace-pre-wrap'>{JSON.stringify(operations, null, 2)}</pre>
      </details>
    </div>
  );
};
