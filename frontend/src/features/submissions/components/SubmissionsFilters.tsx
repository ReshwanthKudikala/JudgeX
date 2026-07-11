import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import {
  LANGUAGE_LABELS,
  VERDICT_LABELS,
  type SubmissionLanguage,
  type SubmissionVerdict,
} from '@/types/submissions';

interface SubmissionsFiltersProps {
  verdict: SubmissionVerdict | 'all';
  language: SubmissionLanguage | 'all';
  search: string;
  onVerdictChange: (v: SubmissionVerdict | 'all') => void;
  onLanguageChange: (v: SubmissionLanguage | 'all') => void;
  onSearchChange: (v: string) => void;
  /** Hide problem title search (problem-scoped tab). */
  hideSearch?: boolean;
}

const VERDICT_OPTIONS = Object.keys(VERDICT_LABELS) as SubmissionVerdict[];
const LANGUAGE_OPTIONS = Object.keys(LANGUAGE_LABELS) as SubmissionLanguage[];

export function SubmissionsFilters({
  verdict,
  language,
  search,
  onVerdictChange,
  onLanguageChange,
  onSearchChange,
  hideSearch = false,
}: SubmissionsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select
        aria-label="Filter by verdict"
        value={verdict}
        onChange={(e) =>
          onVerdictChange(e.target.value as SubmissionVerdict | 'all')
        }
        className="h-9 w-full sm:w-44"
      >
        <option value="all">All verdicts</option>
        {VERDICT_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {VERDICT_LABELS[v]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filter by language"
        value={language}
        onChange={(e) =>
          onLanguageChange(e.target.value as SubmissionLanguage | 'all')
        }
        className="h-9 w-full sm:w-36"
      >
        <option value="all">All languages</option>
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABELS[lang]}
          </option>
        ))}
      </Select>

      {!hideSearch ? (
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search problems…"
          aria-label="Search by problem title"
          className="h-9 sm:ml-auto sm:max-w-xs"
        />
      ) : null}
    </div>
  );
}
