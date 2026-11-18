import { hasProductionWebModel, isProductionWeb } from '@/services/web-session';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  RadioGroup,
  RadioGroupItem,
} from '@origamix/ui';

import {
  Activity,
  Bot,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Moon,
  Palette,
  Save,
  Sun,
  User,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore, type AppTheme } from '@/store/preferences';
import type { AgentUsageScope, ModelSettings } from '@origamix/shared';

const DailyUsage = lazy(() =>
  import('@/components/usage/daily-usage').then(({ DailyUsage }) => ({ default: DailyUsage })),
);

const modelOptions: Array<{
  value: ModelSettings['model'];
  name: string;
  description: string;
}> = [
  {
    value: 'deepseek-flash',
    name: 'DeepSeek Flash',
    description: '响应更快，适合日常页面生成与调整',
  },
  {
    value: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: '能力更强，适合复杂页面和多步骤任务',
  },
];

const sections = [
  { value: 'profile', label: '个人资料', icon: User },
  { value: 'appearance', label: '外观', icon: Palette },
  { value: 'model', label: '模型', icon: Bot },
  { value: 'usage', label: '用量', icon: Activity },
] as const;

export type SettingsSection = (typeof sections)[number]['value'];

interface SettingsPageProps {
  initialSection?: SettingsSection;
  usageScope?: AgentUsageScope;
  onClose: () => void;
}

interface SettingsModalProps extends SettingsPageProps {
  isOpen: boolean;
}

export const SettingsModal = ({
  isOpen,
  initialSection,
  onClose,
  usageScope,
}: SettingsModalProps): React.JSX.Element => (
  <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
    <DialogContent
      showCloseButton={false}
      className='flex h-[min(760px,calc(100vh-32px))] w-[min(920px,calc(100vw-32px))] max-w-none flex-col overflow-hidden p-0 sm:max-w-none'
    >
      <SettingsPage
        key={`${initialSection}:${usageScope?.projectId}:${usageScope?.pageId}`}
        initialSection={initialSection}
        usageScope={usageScope}
        onClose={onClose}
      />
    </DialogContent>
  </Dialog>
);

export const SettingsPage = ({
  initialSection = 'profile',
  usageScope,
  onClose,
}: SettingsPageProps): React.JSX.Element => {
  const { theme, userProfile, setTheme, setUserProfile, setHasModelApiKey } = usePreferencesStore(
    useShallow((state) => ({
      theme: state.theme,
      userProfile: state.userProfile,
      setTheme: state.setTheme,
      setUserProfile: state.setUserProfile,
      setHasModelApiKey: state.setHasModelApiKey,
    })),
  );
  const productionWeb = isProductionWeb();
  const [section, setSection] = useState<SettingsSection>(
    productionWeb && initialSection === 'profile' ? 'appearance' : initialSection,
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelSettings['model']>('deepseek-flash');
  const [userName, setUserName] = useState(userProfile.name);
  const [iconBackground, setIconBackground] = useState(userProfile.iconBackground);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (productionWeb) return;
    let active = true;
    Promise.resolve(window.api?.settings?.getModel?.())
      .then((settings) => {
        if (!active) return;
        const configured = settings?.hasApiKey ?? false;
        setHasSavedKey(configured);
        if (settings) {
          setSelectedModel(settings.model);
          setHasModelApiKey(configured);
        }
      })
      .catch(() => active && setStatus({ kind: 'error', message: '无法读取模型设置。' }))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [productionWeb, setHasModelApiKey]);

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setStatus(null);
    try {
      const result = await window.api?.settings?.saveModel?.({
        provider: 'deepseek',
        model: selectedModel,
        apiKey: apiKey || undefined,
      });
      if (!result) throw new Error('当前环境不支持保存模型设置，请在桌面应用中操作。');
      setHasSavedKey(result.hasApiKey);
      setHasModelApiKey(result.hasApiKey);
      setApiKey('');
      setStatus({ kind: 'success', message: '模型设置已安全保存。' });
    } catch (reason) {
      setStatus({
        kind: 'error',
        message: reason instanceof Error ? reason.message : '保存失败。',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveProfile = async (): Promise<void> => {
    setIsSavingProfile(true);
    setProfileStatus(null);
    try {
      const profile = await window.api?.settings?.saveProfile?.({
        name: userName,
        iconBackground,
      });
      if (!profile) throw new Error('当前环境不支持保存用户资料，请在桌面应用中操作。');
      setUserProfile(profile);
      setUserName(profile.name);
      setProfileStatus({ kind: 'success', message: '用户资料已保存。' });
    } catch (reason) {
      setProfileStatus({
        kind: 'error',
        message: reason instanceof Error ? reason.message : '保存失败。',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const profileColors = [
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#dc2626',
    '#d97706',
    '#059669',
    '#475569',
  ];

  return (
    <section className='flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <header className='window-no-drag-region relative flex h-10 min-h-10 items-center border-b border-zinc-200 px-4.5 dark:border-zinc-800'>
        <div className='relative z-10'>
          <DialogTitle className='m-0 text-sm font-semibold'>设置</DialogTitle>
        </div>
        <Button
          size='icon'
          variant='ghost'
          className='window-no-drag-region ml-auto h-8 min-h-8 w-8 min-w-8'
          onClick={onClose}
          aria-label='关闭设置'
        >
          <X size={17} />
        </Button>
      </header>

      <div className='flex min-h-0 flex-1 flex-col sm:flex-row'>
        <nav
          aria-label='设置分类'
          className='flex shrink-0 gap-1 overflow-x-auto border-b bg-muted/35 p-2 sm:w-44 sm:flex-col sm:border-r sm:border-b-0 sm:p-3'
        >
          {sections
            .filter(({ value }) => !productionWeb || value !== 'profile')
            .map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                size='sm'
                variant={section === value ? 'secondary' : 'ghost'}
                aria-current={section === value ? 'true' : undefined}
                className='shrink-0 justify-start gap-2'
                onClick={() => {
                  setSection(value);
                  scrollContainerRef.current?.scrollTo({ top: 0 });
                }}
              >
                <Icon size={15} />
                {label}
              </Button>
            ))}
        </nav>
        <div ref={scrollContainerRef} className='min-h-0 min-w-0 flex-1 overflow-auto'>
          <div className='mx-auto w-full max-w-3xl px-4 py-5 sm:px-7 sm:py-6'>
            <section hidden={productionWeb || section !== 'profile'}>
              <div className='mb-4'>
                <h2 className='m-0 text-base font-semibold'>用户设置</h2>
                <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                  设置显示在侧边栏底部的名称与图标颜色。
                </p>
              </div>
              <Card className='p-4'>
                <div className='flex items-start gap-4'>
                  <span
                    className='grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-sm'
                    style={{ backgroundColor: iconBackground }}
                  >
                    <User size={27} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <label className='mb-2 block text-xs font-medium'>用户名称</label>
                    <Input
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      placeholder='输入用户名称'
                      maxLength={40}
                      aria-label='用户名称'
                    />
                    <fieldset className='mt-4 border-0 p-0'>
                      <legend className='mb-2 text-xs font-medium'>图标背景色</legend>
                      <div className='flex flex-wrap gap-2'>
                        {profileColors.map((color) => (
                          <Button
                            key={color}
                            size='icon'
                            variant='ghost'
                            className={`h-8 min-h-8 w-8 min-w-8 rounded-full border-2 p-0 ${
                              iconBackground === color
                                ? 'border-zinc-900 dark:border-white'
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setIconBackground(color)}
                            aria-label={`选择背景色 ${color}`}
                          >
                            {iconBackground === color && <Check size={14} className='text-white' />}
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                    <div className='mt-4 flex items-center justify-between gap-3'>
                      <div>
                        {profileStatus && (
                          <p
                            role='status'
                            className={`m-0 text-xs ${
                              profileStatus.kind === 'success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {profileStatus.message}
                          </p>
                        )}
                      </div>
                      <Button
                        size='sm'
                        className='gap-1.5'
                        onClick={saveProfile}
                        disabled={isSavingProfile || !userName.trim()}
                      >
                        <Save size={14} />
                        {isSavingProfile ? '保存中…' : '保存用户设置'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            <section hidden={section !== 'appearance'}>
              <div className='mb-4'>
                <h2 className='m-0 text-base font-semibold'>主题设置</h2>
                <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                  选择 Origamix 工作区的显示主题。
                </p>
              </div>
              <RadioGroup
                aria-label='主题设置'
                value={theme}
                onValueChange={(value) => setTheme(value as AppTheme)}
                className='grid gap-3 sm:grid-cols-2'
              >
                <label className='flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'>
                  <RadioGroupItem value='light' />
                  <Sun size={17} className='text-amber-500' />
                  <span>
                    <strong className='block'>浅色</strong>
                    <small className='text-zinc-500'>明亮、清晰的默认主题</small>
                  </span>
                </label>
                <label className='flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'>
                  <RadioGroupItem value='dark' />
                  <Moon size={17} className='text-blue-500' />
                  <span>
                    <strong className='block'>深色</strong>
                    <small className='text-zinc-500'>适合低光环境</small>
                  </span>
                </label>
              </RadioGroup>
            </section>

            {productionWeb && (
              <section hidden={section !== 'model'}>
                <h2 className='mb-4 text-base font-semibold'>模型设置</h2>
                <Card className='gap-2 p-4'>
                  <p className='text-sm font-medium'>DeepSeek Flash</p>
                  <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                    {hasProductionWebModel() ? '已配置 API Key。' : '尚未配置 API Key。'}
                    由部署者在 Web 宿主配置 DEEPSEEK_API_KEY。
                  </p>
                </Card>
              </section>
            )}
            <section hidden={productionWeb || section !== 'model'}>
              <div className='mb-4 flex items-start justify-between gap-4'>
                <div>
                  <h2 className='m-0 text-base font-semibold'>模型设置</h2>
                  <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                    先选择模型，再配置对应的 API Key。
                  </p>
                </div>
                {hasSavedKey && (
                  <Badge variant='secondary' className='text-emerald-700 dark:text-emerald-300'>
                    <Check size={12} />
                    已配置
                  </Badge>
                )}
              </div>

              <div className='mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                <span className='grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900'>
                  1
                </span>
                选择模型
              </div>
              <RadioGroup
                value={selectedModel}
                onValueChange={(value) => setSelectedModel(value as ModelSettings['model'])}
                className='mb-6 grid gap-3 sm:grid-cols-2'
                aria-label='DeepSeek 模型'
              >
                {modelOptions.map((option) => {
                  const selected = selectedModel === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/20'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
                      }`}
                    >
                      <RadioGroupItem value={option.value} className='mt-1' />
                      <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white'>
                        <Bot size={18} />
                      </span>
                      <span className='min-w-0'>
                        <strong className='block'>{option.name}</strong>
                        <span className='mt-1 block text-xs text-zinc-500 dark:text-zinc-400'>
                          {option.description}
                        </span>
                        <code className='mt-2 block text-[11px] text-zinc-400 dark:text-zinc-500'>
                          {option.value}
                        </code>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>

              <div className='mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400'>
                <span className='grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900'>
                  2
                </span>
                设置 API Key
              </div>
              <Card className='p-4'>
                <label className='mb-2 block text-xs font-medium'>DeepSeek API Key</label>
                <div className='flex items-center gap-2'>
                  <div className='relative min-w-0 flex-1'>
                    <KeyRound
                      size={15}
                      className='pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400'
                    />
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        hasSavedKey ? '已保存密钥，输入新值可替换' : '输入 DeepSeek API Key'
                      }
                      className='w-full pl-9 pr-9'
                      disabled={isLoading}
                      aria-label='DeepSeek API Key'
                    />
                    <Button
                      size='icon-sm'
                      variant='ghost'
                      className='absolute top-1/2 right-1 h-7 min-h-7 w-7 min-w-7 -translate-y-1/2'
                      onClick={() => setShowApiKey((value) => !value)}
                      aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </div>
                  <Button
                    className='gap-1.5'
                    onClick={save}
                    disabled={isLoading || isSaving || (!apiKey && !hasSavedKey)}
                  >
                    <Save size={14} />
                    {isSaving ? '保存中…' : '保存'}
                  </Button>
                </div>
                {status && (
                  <p
                    role='status'
                    className={`mt-3 mb-0 text-xs ${status.kind === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                  >
                    {status.message}
                  </p>
                )}
              </Card>
            </section>
            {section === 'usage' && (
              <Suspense
                fallback={
                  <p role='status' className='text-sm text-muted-foreground'>
                    正在加载用量…
                  </p>
                }
              >
                <DailyUsage initialScope={usageScope} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
