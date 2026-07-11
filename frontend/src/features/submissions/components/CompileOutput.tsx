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
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-[#0a0c10] p-3 font-mono text-xs leading-relaxed text-error">
      {output}
    </pre>
  );
});
