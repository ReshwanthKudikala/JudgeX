import { MarkdownRenderer } from '@/features/editorials/components/MarkdownRenderer';
import type { ProblemEditorial } from '@/types/editorials';

interface EditorialPanelProps {
  editorial: ProblemEditorial;
}

export function EditorialPanel({ editorial }: EditorialPanelProps) {
  const updated = new Date(editorial.updatedAt);

  return (
    <article className="space-y-4">
      <header className="space-y-1 border-b border-border pb-3">
        <h2 className="text-lg font-semibold text-foreground">{editorial.title}</h2>
        <p className="text-xs text-muted">
          Updated{' '}
          {Number.isNaN(updated.getTime())
            ? editorial.updatedAt
            : updated.toLocaleString()}
        </p>
      </header>
      <MarkdownRenderer markdown={editorial.markdown} />
    </article>
  );
}
