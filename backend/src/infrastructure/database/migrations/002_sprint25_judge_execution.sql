-- Sprint 25: richer test-case metadata, submission execution fields, and verdicts.
-- Additive / backwards-compatible with 001_init_schema.

-- Optional explanation on public sample (and admin) test cases.
ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Aggregate + capture fields for judged submissions.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS passed_tests INT
    CHECK (passed_tests IS NULL OR passed_tests >= 0);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS total_tests INT
    CHECK (total_tests IS NULL OR total_tests >= 0);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS stdout TEXT;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS stderr TEXT;

-- Extended terminal verdicts (PostgreSQL 17 allows ADD VALUE inside a transaction).
ALTER TYPE verdict ADD VALUE IF NOT EXISTS 'memory_limit_exceeded';
ALTER TYPE verdict ADD VALUE IF NOT EXISTS 'internal_error';
