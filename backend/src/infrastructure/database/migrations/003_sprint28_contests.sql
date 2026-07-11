-- Sprint 28: Contest System (additive / backwards-compatible).

DO $$ BEGIN
  CREATE TYPE contest_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contest_status AS ENUM ('upcoming', 'running', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  visibility contest_visibility NOT NULL DEFAULT 'public',
  status contest_status NOT NULL DEFAULT 'upcoming',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_contests_window CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_contests_window
  ON contests (start_time, end_time)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_contests_status
  ON contests (status)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  points INT NOT NULL DEFAULT 100 CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_problems_order
  ON contest_problems (contest_id, display_order ASC);

CREATE TABLE IF NOT EXISTS contest_participants (
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_participants_user
  ON contest_participants (user_id);

-- Optional contest linkage on submissions (additive; judge pipeline unchanged).
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES contests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_contest
  ON submissions (contest_id, user_id, problem_id)
  WHERE contest_id IS NOT NULL;
