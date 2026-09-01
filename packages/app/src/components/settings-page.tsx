import { Button, Card, Chip, Input, Radio, RadioGroup } from '@heroui/react';
import { ArrowLeft, Bot, Check, Eye, EyeOff, KeyRound, Moon, Save, Sun, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppTheme } from './sidebar';
import type { UserProfile } from './sidebar';

interface SettingsPageProps {
  theme: AppTheme;
  sidebarCollapsed: boolean;
  userProfile: UserProfile;
  onThemeChange: (theme: AppTheme) => void;
  onProfileChange: (profile: UserProfile) => void;
  onBack: () => void;
}

export function SettingsPage({
  theme,
  sidebarCollapsed,
  userProfile,
  onThemeChange,
  onProfileChange,
  onBack,
}: SettingsPageProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
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

  useEffect(() => {
    let active = true;
    Promise.resolve(window.api?.settings?.getModel?.())
      .then((settings) => active && setHasSavedKey(settings?.hasApiKey ?? false))
      .catch(() => active && setStatus({ kind: 'error', message: '无法读取模型设置。' }))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setStatus(null);
    try {
      const result = await window.api?.settings?.saveModel?.({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        apiKey: apiKey || undefined,
      });
      if (!result) throw new Error('当前环境不支持保存模型设置，请在桌面应用中操作。');
      setHasSavedKey(result.hasApiKey);
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
      onProfileChange(profile);
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
      <header className='flex h-15 min-h-15 items-center border-b border-zinc-200 px-4.5 dark:border-zinc-800'>
        {!sidebarCollapsed && (
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='mr-2 h-8 min-h-8 w-8 min-w-8'
            onPress={onBack}
            aria-label='返回工作区'
          >
            <ArrowLeft size={17} />
          </Button>
        )}
        <div className={sidebarCollapsed ? 'pl-10' : undefined}>
          <h1 className='m-0 text-sm font-semibold'>设置</h1>
          <p className='m-0 text-[11px] text-zinc-500 dark:text-zinc-400'>应用外观与模型连接</p>
        </div>
      </header>

      <div className='min-h-0 flex-1 overflow-auto'>
        <div className='mx-auto w-full max-w-3xl px-8 py-9'>
          <section className='mb-10'>
            <div className='mb-4'>
              <h2 className='m-0 text-base font-semibold'>用户设置</h2>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                设置显示在侧边栏底部的名称与图标颜色。
              </p>
            </div>
            <Card className='p-4' variant='secondary'>
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
                          isIconOnly
                          size='sm'
                          variant='ghost'
                          className={`h-8 min-h-8 w-8 min-w-8 rounded-full border-2 p-0 ${
                            iconBackground === color
                              ? 'border-zinc-900 dark:border-white'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onPress={() => setIconBackground(color)}
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
                      onPress={saveProfile}
                      isDisabled={isSavingProfile || !userName.trim()}
                    >
                      <Save size={14} />
                      {isSavingProfile ? '保存中…' : '保存用户设置'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className='mb-10'>
            <div className='mb-4'>
              <h2 className='m-0 text-base font-semibold'>主题设置</h2>
              <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                选择 Origamix 工作区的显示主题。
              </p>
            </div>
            <RadioGroup
              aria-label='主题设置'
              value={theme}
              onChange={(value) => onThemeChange(value as AppTheme)}
              orientation='horizontal'
              className='grid grid-cols-2 gap-3'
            >
              <Radio value='light'>
                <Radio.Content className='flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Sun size={17} className='text-amber-500' />
                  <span>
                    <strong className='block'>浅色</strong>
                    <small className='text-zinc-500'>明亮、清晰的默认主题</small>
                  </span>
                </Radio.Content>
              </Radio>
              <Radio value='dark'>
                <Radio.Content className='flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900'>
                  <Radio.Control>
                    <Radio.Indicator />
                  </Radio.Control>
                  <Moon size={17} className='text-blue-500' />
                  <span>
                    <strong className='block'>深色</strong>
                    <small className='text-zinc-500'>适合低光环境</small>
                  </span>
                </Radio.Content>
              </Radio>
            </RadioGroup>
          </section>

          <section>
            <div className='mb-4 flex items-start justify-between gap-4'>
              <div>
                <h2 className='m-0 text-base font-semibold'>模型设置</h2>
                <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                  先选择模型，再配置对应的 API Key。
                </p>
              </div>
              {hasSavedKey && (
                <Chip size='sm' color='success' variant='soft'>
                  <Check size={12} />
                  已配置
                </Chip>
              )}
            </div>

            <div className='mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400'>
              <span className='grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900'>
                1
              </span>
              选择模型
            </div>
            <Card
              className='mb-6 border-blue-500 bg-blue-50/60 p-4 dark:border-blue-700 dark:bg-blue-950/20'
              variant='secondary'
            >
              <div className='flex items-center gap-3'>
                <span className='grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white'>
                  <Bot size={18} />
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <strong>DeepSeek V4 Flash</strong>
                    <Chip size='sm' variant='soft'>
                      当前唯一支持
                    </Chip>
                  </div>
                  <p className='mt-1 mb-0 text-xs text-zinc-500 dark:text-zinc-400'>
                    deepseek-v4-flash · 支持工具调用与结构化输出
                  </p>
                </div>
                <span className='grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white'>
                  <Check size={12} />
                </span>
              </div>
            </Card>

            <div className='mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400'>
              <span className='grid h-5 w-5 place-items-center rounded-full bg-zinc-900 text-[10px] text-white dark:bg-zinc-100 dark:text-zinc-900'>
                2
              </span>
              设置 API Key
            </div>
            <Card className='p-4' variant='secondary'>
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
                    isIconOnly
                    size='sm'
                    variant='ghost'
                    className='absolute top-1/2 right-1 h-7 min-h-7 w-7 min-w-7 -translate-y-1/2'
                    onPress={() => setShowApiKey((value) => !value)}
                    aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
                <Button
                  className='gap-1.5'
                  onPress={save}
                  isDisabled={isLoading || isSaving || (!apiKey && !hasSavedKey)}
                >
                  <Save size={14} />
                  {isSaving ? '保存中…' : '保存'}
                </Button>
              </div>
              <p className='mt-2 mb-0 text-[11px] text-zinc-500 dark:text-zinc-400'>
                API Key 由 Electron 系统加密能力保存，不会写入项目文件或回显明文。
              </p>
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
        </div>
      </div>
    </section>
  );
}
