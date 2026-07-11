import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

import { cn } from '@/utils/cn';

import 'highlight.js/styles/github-dark.css';

interface MarkdownBodyProps {
  markdown: string;
  className?: string;
}

export const MarkdownBody = memo(function MarkdownBody({
  markdown,
  className,
}: MarkdownBodyProps) {
  return (
    <div
      className={cn(
        'editorial-markdown prose prose-invert max-w-none text-[15px] leading-7 text-muted-foreground',
        '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground',
        '[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground',
        '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground',
        '[&_p]:my-3',
        '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-1',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted',
        '[&_a]:text-primary [&_a]:underline',
        '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/20 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2',
        '[&_code]:rounded [&_code]:bg-[#0c0e12] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
        '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-[#0c0e12] [&_pre]:p-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
