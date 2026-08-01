import { memo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import { useThemeStore } from '@/store/theme.store';
import { cn } from '@/utils/cn';

import darkThemeUrl from 'highlight.js/styles/github-dark.css?url';
import lightThemeUrl from 'highlight.js/styles/github.css?url';

interface MarkdownBodyProps {
  markdown: string;
  className?: string;
}

const HLJS_LINK_ID = 'judgex-hljs-theme';

function useHighlightTheme(resolved: 'light' | 'dark') {
  useEffect(() => {
    let link = document.getElementById(HLJS_LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = HLJS_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = resolved === 'dark' ? darkThemeUrl : lightThemeUrl;
  }, [resolved]);
}

export const MarkdownBody = memo(function MarkdownBody({
  markdown,
  className,
}: MarkdownBodyProps) {
  const resolved = useThemeStore((s) => s.resolved);
  useHighlightTheme(resolved);

  return (
    <div
      className={cn(
        'editorial-markdown max-w-none text-[15px] leading-7 text-muted-foreground',
        '[&_h1]:mb-3 [&_h1]:mt-8 [&_h1]:scroll-mt-20 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground',
        '[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:scroll-mt-20 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground',
        '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground',
        '[&_p]:my-3',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-1',
        '[&_blockquote]:my-4 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:bg-overlay [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:italic [&_blockquote]:text-muted',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:text-sm',
        '[&_th]:border [&_th]:border-border [&_th]:bg-surface [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2',
        '[&_code]:rounded [&_code]:bg-editor [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground',
        '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-editor [&_pre]:p-4 [&_pre]:shadow-card',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:leading-6',
        '[&_hr]:my-6 [&_hr]:border-border',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
