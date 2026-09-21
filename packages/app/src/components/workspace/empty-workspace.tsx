import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react';

export const EmptyWorkspace = ({
  onCreateProject,
}: {
  onCreateProject: () => void;
}): React.JSX.Element => {
  const supportsNativeProjectDirectories = Boolean(window.api?.dialog);
  return (
    <div className='flex flex-1 flex-col items-center justify-center pb-12 text-center'>
      <div className='mb-4 grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400'>
        <Sparkles size={22} />
      </div>
      <h1 className='m-0 text-xl font-semibold tracking-tight'>现在开始 AI Schema 旅程吧</h1>
      <p className='mt-2 mb-5 text-zinc-500 dark:text-zinc-400'>
        {supportsNativeProjectDirectories
          ? '从左侧选择页面，或新建一个项目开始。'
          : '从左侧选择服务端项目。浏览器端项目下载与导入能力尚未接入。'}
      </p>
      <Button
        className='gap-1.5'
        onClick={onCreateProject}
        disabled={!supportsNativeProjectDirectories}
      >
        <Plus size={14} />
        新建项目
      </Button>
    </div>
  );
};
