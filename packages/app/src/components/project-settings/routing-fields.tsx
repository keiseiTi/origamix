import { Button, Field, FieldLabel, Input } from '@origamix/ui';
import type { ProjectRouting } from '@origamix/shared';

export const RoutingFields = ({
  value,
  onChange,
  disabled = false,
}: {
  value: ProjectRouting;
  onChange: (value: ProjectRouting) => void;
  disabled?: boolean;
}) => (
  <>
    <Field>
      <FieldLabel>路由模式</FieldLabel>
      <div className='grid grid-cols-2 gap-2' role='group' aria-label='路由模式'>
        {(
          [
            { mode: 'browser', label: '浏览器路径' },
            { mode: 'hash', label: 'Hash 路径' },
          ] as const
        ).map((item) => (
          <Button
            key={item.mode}
            type='button'
            disabled={disabled}
            variant={value.mode === item.mode ? 'secondary' : 'outline'}
            aria-pressed={value.mode === item.mode}
            onClick={() => onChange({ ...value, mode: item.mode })}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>
        {value.mode === 'browser'
          ? '例如 /role-manage；部署时需让服务器将页面路径回退到应用入口。'
          : '例如 /#/role-manage；适合不支持页面路径回退的静态托管。'}
      </p>
    </Field>
    <Field>
      <FieldLabel htmlFor='project-route-base'>应用访问前缀</FieldLabel>
      <Input
        id='project-route-base'
        value={value.basePath}
        disabled={disabled}
        required
        maxLength={200}
        placeholder='/admin/'
        onChange={(event) => onChange({ ...value, basePath: event.target.value })}
        onBlur={() => {
          const path = value.basePath.trim();
          if (path.startsWith('/') && !path.endsWith('/'))
            onChange({ ...value, basePath: `${path}/` });
        }}
        pattern='/(?:[A-Za-z0-9_-]+/)*'
      />
      <p className='text-xs text-muted-foreground'>
        部署在网站子目录时填写，例如 /admin/；默认 /。两种路由模式均使用此前缀加载应用资源。
      </p>
    </Field>
  </>
);
