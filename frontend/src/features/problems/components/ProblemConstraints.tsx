import { memo, useMemo } from 'react';

interface ProblemConstraintsProps {
  constraintsText?: string | null;
}

/** Split constraints into bullet items while preserving meaningful lines. */
function parseConstraintLines(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);
}

export const ProblemConstraints = memo(function ProblemConstraints({
  constraintsText,
}: ProblemConstraintsProps) {
  const lines = useMemo(
    () => (constraintsText ? parseConstraintLines(constraintsText) : []),
    [constraintsText],
  );

  if (!lines.length) return null;

  return (
    <section aria-labelledby="problem-constraints-heading" className="space-y-2">
      <h2
        id="problem-constraints-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Constraints
      </h2>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-muted-foreground">
        {lines.map((line, i) => (
          <li key={i} className="whitespace-pre-wrap">
            <code className="rounded bg-white/5 px-1 font-mono text-[13px] text-muted-foreground">
              {line}
            </code>
          </li>
        ))}
      </ul>
    </section>
  );
});
