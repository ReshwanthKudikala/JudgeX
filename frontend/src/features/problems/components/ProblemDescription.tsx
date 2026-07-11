import { memo } from 'react';

import { SafeRichText } from '@/utils/safe-rich-text';

interface ProblemDescriptionProps {
  statement: string;
}

export const ProblemDescription = memo(function ProblemDescription({
  statement,
}: ProblemDescriptionProps) {
  return (
    <section aria-labelledby="problem-description-heading" className="space-y-2">
      <h2 id="problem-description-heading" className="sr-only">
        Description
      </h2>
      <SafeRichText content={statement} />
    </section>
  );
});
