import { memo } from 'react';

import type { ProblemExample } from '@/types/problems';

interface ProblemExamplesProps {
  examples: ProblemExample[];
}

export const ProblemExamples = memo(function ProblemExamples({
  examples,
}: ProblemExamplesProps) {
  if (!examples.length) return null;

  return (
    <section aria-labelledby="problem-examples-heading" className="space-y-4">
      <h2
        id="problem-examples-heading"
        className="text-sm font-semibold uppercase tracking-wide text-muted"
      >
        Examples
      </h2>
      <div className="space-y-4">
        {examples.map((example, index) => (
          <article
            key={index}
            className="rounded-lg border border-border bg-[#12151b] p-4"
            aria-label={`Example ${index + 1}`}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Example {index + 1}
            </p>
            <MonoBlock label="Sample Input" value={example.input} />
            <MonoBlock label="Sample Output" value={example.output} className="mt-3" />
            {example.explanation ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted">Explanation</p>
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
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <pre className="overflow-x-auto rounded-md border border-border bg-[#0c0e12] p-3 font-mono text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}
