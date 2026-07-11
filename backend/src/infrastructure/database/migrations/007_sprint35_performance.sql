-- Sprint 35 — Performance indexes for hot read paths.
-- Additive only; does not change schema contracts.

-- Submissions: timeframe filters for leaderboard / analytics.
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at
  ON submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_verdict_submitted
  ON submissions (verdict, submitted_at DESC)
  WHERE verdict = 'accepted';

-- Problems: published catalog browse by difficulty + recency.
CREATE INDEX IF NOT EXISTS idx_problems_published_difficulty_created
  ON problems (difficulty, created_at DESC)
  WHERE is_published = true AND is_deleted = false;

-- Contests: public listing by status window.
CREATE INDEX IF NOT EXISTS idx_contests_public_status_start
  ON contests (status, start_time DESC)
  WHERE is_deleted = false AND visibility = 'public';

-- Discussions: title/body search (ILIKE / trigram).
CREATE INDEX IF NOT EXISTS idx_discussions_title_trgm
  ON discussions USING GIN (title gin_trgm_ops)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_discussions_body_trgm
  ON discussions USING GIN (body gin_trgm_ops)
  WHERE is_deleted = false;

-- Contest participants: batch membership checks (user → contests).
-- Supersedes idx_contest_participants_user (user_id alone) — drop redundant index.
CREATE INDEX IF NOT EXISTS idx_contest_participants_user_contest
  ON contest_participants (user_id, contest_id);

DROP INDEX IF EXISTS idx_contest_participants_user;
