import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Eye } from 'lucide-react';

export type WorkspaceMode = 'chat' | 'edit';

interface WorkspaceHeaderProps {
  pageName: string;
  mode: WorkspaceMode;
  sidebarCollapsed: boolean;
  onModeChange: (mode: WorkspaceMode) => void;
}

export function WorkspaceHeader({
  pageName,
  mode,
  sidebarCollapsed,
  onModeChange
}: WorkspaceHeaderProps): React.JSX.Element {
  return (
    <header className="relative grid h-15 min-h-15 grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-200 px-4.5 dark:border-zinc-800">
      <div className={`flex items-center font-semibold ${sidebarCollapsed ? 'pl-9' : ''}`}>
        <span>{pageName}</span>
      </div>
      <ToggleButtonGroup
        aria-label="页面模式"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([mode])}
        onSelectionChange={(keys) => {
          const selectedMode = [...keys][0];
          if (selectedMode === 'chat' || selectedMode === 'edit') onModeChange(selectedMode);
        }}
        size="sm"
        className="h-8 min-w-34"
      >
        <ToggleButton id="chat" className="min-w-16 text-xs">
          对话
        </ToggleButton>
        <ToggleButton id="edit" className="min-w-16 text-xs">
          编辑
        </ToggleButton>
      </ToggleButtonGroup>
      <Button className="justify-self-end gap-1.5" size="sm" variant="secondary">
        <Eye size={14} />
        <span>预览</span>
      </Button>
    </header>
  );
}
