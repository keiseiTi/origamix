import { Button } from '@origamix/ui';
interface ObsoleteFieldsProps {
  fields: string[];
  onRemove: () => void;
}
export const ObsoleteFields = ({
  fields,
  onRemove,
}: ObsoleteFieldsProps): React.JSX.Element | null =>
  fields.length ? (
    <div
      role='status'
      className='space-y-2 border-b border-border p-3 text-xs text-muted-foreground'
    >
      <p>当前物料已移除这些属性：{fields.join('、')}。保存前请检查并显式移除。</p>
      <Button size='sm' variant='outline' onClick={onRemove}>
        移除已失效属性
      </Button>
    </div>
  ) : null;
