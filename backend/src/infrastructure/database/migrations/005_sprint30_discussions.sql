-- Sprint 30: Discussions & Community (additive / backwards-compatible).

CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  like_count INT NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count INT NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussions_problem_created
  ON discussions (problem_id, created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_discussions_problem_active
  ON discussions (problem_id, updated_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_discussions_problem_liked
  ON discussions (problem_id, like_count DESC, created_at DESC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_discussions_tags
  ON discussions USING gin (tags)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS discussion_comments (
  id UUID PRIMARY KEY,
  discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_comment_id UUID REFERENCES discussion_comments(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussion_comments_thread
  ON discussion_comments (discussion_id, created_at ASC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_discussion_comments_parent
  ON discussion_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL AND is_deleted = false;

CREATE TABLE IF NOT EXISTS discussion_reports (
  id UUID PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(16) NOT NULL CHECK (target_type IN ('discussion', 'comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_discussion_reports_once UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_discussion_reports_open
  ON discussion_reports (status, created_at DESC)
  WHERE status = 'open';
