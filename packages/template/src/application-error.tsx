import { Link, useRouteError } from 'react-router';

const ApplicationError = (): React.JSX.Element => {
  const error = useRouteError();
  return (
    <main
      role='alert'
      className='min-h-screen bg-white p-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
    >
      <h1 className='text-lg font-semibold'>应用暂时无法显示</h1>
      <p className='mt-2'>
        {error instanceof Error ? error.message : '请检查项目页面与布局配置后刷新。'}
      </p>
      <Link to='/' className='mt-4 inline-block underline focus-visible:outline-2'>
        返回首页
      </Link>
    </main>
  );
};
export default ApplicationError;
