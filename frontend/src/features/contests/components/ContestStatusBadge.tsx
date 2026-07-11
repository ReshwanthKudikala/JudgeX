import { Badge } from '@/components/ui/Badge';
import {
  CONTEST_STATUS_LABELS,
  type ContestStatus,
} from '@/types/contests';

const VARIANT: Record<ContestStatus, 'default' | 'primary' | 'success'> = {
  upcoming: 'default',
  running: 'primary',
  ended: 'success',
};

export function ContestStatusBadge({ status }: { status: ContestStatus }) {
  return (
    <Badge variant={VARIANT[status]}>{CONTEST_STATUS_LABELS[status]}</Badge>
  );
}
