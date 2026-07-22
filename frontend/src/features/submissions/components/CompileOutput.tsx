import { memo } from 'react';

interface CompileOutputProps {
  output: string | null | undefined;
}

export const CompileOutput = memo(function CompileOutput({ output }: CompileOutputProps) {
  if (!output) {
    return (
      <p className="font-mono text-xs text-muted-foreground">No compile output.</p>
    );
  }

  return (
    <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-error">
      {output}
    </pre>
  );
});
