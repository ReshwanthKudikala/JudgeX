import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { getFieldErrorDetails, getFriendlyErrorMessage } from '@/utils/errors';

/**
 * Apply backend validation issues onto RHF fields when details are present.
 * Always returns a form-level message suitable for a banner / toast.
 */
export function applyApiFormErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fallbackMessage: string,
): string {
  const details = getFieldErrorDetails(err);
  let matched = false;

  for (const detail of details) {
    if (!detail.path) continue;
    setError(detail.path as Path<T>, { type: 'server', message: detail.message });
    matched = true;
  }

  const message = getFriendlyErrorMessage(err, fallbackMessage);
  if (!matched) {
    setError('root' as Path<T>, { type: 'server', message });
  }
  return message;
}
