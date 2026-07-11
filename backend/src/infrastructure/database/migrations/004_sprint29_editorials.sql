-- Sprint 29: Editorials (additive / backwards-compatible).
-- AI learning feedback reuses existing ai_feedback_type values
-- (bug_hint, complexity, optimization, edge_cases, compile_explanation).

CREATE TABLE IF NOT EXISTS editorials (
  id UUID PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  markdown TEXT NOT NULL,
  difficulty difficulty NOT NULL DEFAULT 'medium',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_editorials_problem UNIQUE (problem_id)
);

CREATE INDEX IF NOT EXISTS idx_editorials_published
  ON editorials (problem_id)
  WHERE published = true;
