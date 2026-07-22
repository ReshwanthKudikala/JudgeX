import { memo } from 'react';

import type { ProblemExample } from '@/types/problems';
import { cn } from '@/utils/cn';

interface ProblemExamplesProps {
  examples: ProblemExample[];
}

export const ProblemExamples = memo(function ProblemExamples({
  examples,
}: ProblemExamplesProps) {
  if (!examples.length) return null;

  return (
    <section aria-labelledby="problem-examples-heading" className="space-y-3">
      <h2
        id="problem-examples-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Examples
      </h2>
      <div className="space-y-3">
        {examples.map((example, index) => (
          <article
            key={index}
            className="rounded-md border border-border/80 px-3 py-2.5"
            aria-label={`Example ${index + 1}`}
          >
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Example {index + 1}
            </p>
            <MonoBlock label="Input" value={example.input} />
            <MonoBlock label="Output" value={example.output} className="mt-2" />
            {example.explanation ? (
              <div className="mt-2">
                <p className="mb-0.5 text-[11px] font-medium text-muted">Explanation</p>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {example.explanation}
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
});

function MonoBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-0.5 text-[11px] font-medium text-muted">{label}</p>
      <pre
        className={cn(
          'overflow-x-auto rounded border border-border/60 bg-[#0c0e12] px-2.5 py-2',
          'font-mono text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap',
        )}
      >
        {value}
      </pre>
    </div>
  );
}
