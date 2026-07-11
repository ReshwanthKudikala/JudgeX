-- JudgeX initial schema (DATABASE_DESIGN.md §3).
-- Idempotent where practical so existing test DBs can adopt migrations safely.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE language AS ENUM ('python', 'cpp');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('queued', 'running', 'completed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verdict AS ENUM ('accepted', 'wrong_answer', 'tle', 'runtime_error', 'compile_error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_feedback_type AS ENUM (
    'compile_explanation',
    'bug_hint',
    'complexity',
    'edge_cases',
    'optimization'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY,
  slug VARCHAR(120) NOT NULL,
  title VARCHAR(200) NOT NULL,
  statement TEXT NOT NULL,
  constraints_text TEXT,
  difficulty difficulty NOT NULL,
  time_limit_ms INT NOT NULL DEFAULT 2000 CHECK (time_limit_ms > 0),
  memory_limit_mb INT NOT NULL DEFAULT 256 CHECK (memory_limit_mb > 0),
  total_submissions BIGINT NOT NULL DEFAULT 0,
  total_accepted BIGINT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_problems_slug UNIQUE (slug),
  CONSTRAINT ck_problems_accepted CHECK (total_accepted <= total_submissions)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tags_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS problem_tags (
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (problem_id, tag_id)
);

CREATE TABLE IF NOT EXISTS problem_examples (
  id UUID PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  explanation TEXT,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  input_ref TEXT NOT NULL,
  expected_output_ref TEXT NOT NULL,
  is_inline BOOLEAN NOT NULL DEFAULT true,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum VARCHAR(64),
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  problem_id UUID NOT NULL REFERENCES problems(id),
  language language NOT NULL,
  source_code TEXT NOT NULL,
  status submission_status NOT NULL DEFAULT 'queued',
  verdict verdict,
  compile_output TEXT,
  runtime_ms INT CHECK (runtime_ms IS NULL OR runtime_ms >= 0),
  memory_kb INT CHECK (memory_kb IS NULL OR memory_kb >= 0),
  failed_test_index INT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  judged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission_test_results (
  id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
  test_index INT NOT NULL,
  status verdict NOT NULL,
  runtime_ms INT CHECK (runtime_ms IS NULL OR runtime_ms >= 0),
  memory_kb INT CHECK (memory_kb IS NULL OR memory_kb >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_result_submission_index UNIQUE (submission_id, test_index)
);

CREATE TABLE IF NOT EXISTS user_statistics (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  problems_solved INT NOT NULL DEFAULT 0,
  total_submissions INT NOT NULL DEFAULT 0,
  total_accepted INT NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_solved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_user_stats_accepted CHECK (total_accepted <= total_submissions),
  CONSTRAINT ck_user_stats_rate CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100)
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_type ai_feedback_type NOT NULL DEFAULT 'compile_explanation',
  prompt_snapshot TEXT,
  response_text TEXT NOT NULL,
  was_blocked BOOLEAN NOT NULL DEFAULT false,
  provider VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (DATABASE_DESIGN.md §6)
CREATE INDEX IF NOT EXISTS idx_users_active ON users (id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems (difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_published ON problems (slug)
  WHERE is_published = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_problems_created_by ON problems (created_by);
CREATE INDEX IF NOT EXISTS idx_problems_title_trgm ON problems USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_problem_tags_tag ON problem_tags (tag_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_examples_problem ON problem_examples (problem_id, display_order);
CREATE INDEX IF NOT EXISTS idx_test_cases_problem ON test_cases (problem_id, display_order);
CREATE INDEX IF NOT EXISTS idx_test_cases_public ON test_cases (problem_id, display_order)
  WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_submissions_user_created ON submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user_problem_created
  ON submissions (user_id, problem_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_created ON submissions (problem_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_accepted ON submissions (user_id, problem_id)
  WHERE verdict = 'accepted';
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);
CREATE INDEX IF NOT EXISTS idx_results_test_case ON submission_test_results (test_case_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_ranking
  ON user_statistics (problems_solved DESC, acceptance_rate DESC, last_solved_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_submission ON ai_feedback (submission_id, created_at DESC);
