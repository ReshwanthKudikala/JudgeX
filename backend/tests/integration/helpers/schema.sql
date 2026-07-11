-- Minimal schema for JudgeX integration tests (DATABASE_DESIGN.md).
-- Applied by tests/integration/helpers/setup.js — not a production migration.

CREATE EXTENSION IF NOT EXISTS citext;

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

-- Additive AI audit table (DATABASE_DESIGN.md §9.4). Optional for MVP reads;
-- used when explanations are persisted after CE or via the AI API.
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
