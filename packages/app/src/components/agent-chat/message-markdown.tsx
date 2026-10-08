import ReactMarkdown from 'react-markdown';

export const MessageMarkdown = ({ content }: { content: string }): React.JSX.Element => (
  <div className='min-w-0 break-words text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'>
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className='my-2 whitespace-pre-wrap'>{children}</p>,
        h1: ({ children }) => <h1 className='my-3 text-lg font-semibold'>{children}</h1>,
        h2: ({ children }) => <h2 className='my-3 text-base font-semibold'>{children}</h2>,
        h3: ({ children }) => <h3 className='my-2 font-semibold'>{children}</h3>,
        ul: ({ children }) => <ul className='my-2 list-disc space-y-1 pl-5'>{children}</ul>,
        ol: ({ children }) => <ol className='my-2 list-decimal space-y-1 pl-5'>{children}</ol>,
        li: ({ children }) => <li className='pl-0.5'>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className='my-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300'>
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary underline underline-offset-2 hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          >
            {children}
          </a>
        ),
        pre: ({ children }) => (
          <pre className='my-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-900 [&_code]:bg-transparent [&_code]:p-0 dark:bg-zinc-900 dark:text-zinc-100'>
            {children}
          </pre>
        ),
        code: ({ children }) => (
          <code className='rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'>
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
