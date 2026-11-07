import { SYSTEM_PAGE_ROLES, type PageRoleState, type PageRoleId } from '@origamix/shared';
import {
  Field,
  FieldLabel,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@origamix/ui';

export type PageRoleSelection = PageRoleId | 'none';

export const PageRoleField = ({
  value,
  onChange,
  state,
  pageId,
  disabled,
}: {
  value: PageRoleSelection;
  onChange: (value: PageRoleSelection) => void;
  state: PageRoleState;
  pageId?: string;
  disabled: boolean;
}) => {
  const assigned = value === 'none' ? undefined : state.roles.assignments[value];
  const replacement =
    assigned && assigned !== pageId
      ? state.pages.find((page) => page.pageId === assigned)
      : undefined;
  return (
    <Field>
      <FieldLabel htmlFor='page-role'>页面角色</FieldLabel>
      <Select
        value={value}
        disabled={disabled}
        items={[
          { value: 'none', label: '默认' },
          ...SYSTEM_PAGE_ROLES.map((role) => ({ value: role.id, label: role.name })),
        ]}
        onValueChange={(next) => {
          if (next === 'none' || SYSTEM_PAGE_ROLES.some((role) => role.id === next))
            onChange(next as PageRoleSelection);
        }}
      >
        <SelectTrigger id='page-role' aria-label='页面角色'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='none'>默认</SelectItem>
          {SYSTEM_PAGE_ROLES.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className='text-xs text-muted-foreground'>
        每种角色在项目内只能关联一个页面，仅标识页面用途。
      </p>
      {replacement && (
        <p role='status' className='text-sm text-muted-foreground'>
          保存后将把「{SYSTEM_PAGE_ROLES.find((role) => role.id === value)?.name}」从「
          {replacement.name}」转移到此页面。
        </p>
      )}
    </Field>
  );
};
