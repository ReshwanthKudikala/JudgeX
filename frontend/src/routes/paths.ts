export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  resendVerification: '/resend-verification',
  problems: '/problems',
  /** Detail route uses the problem slug (backend resource key). */
  problemDetail: (slug = ':slug') => `/problems/${slug}`,
  discussionDetail: (slug = ':slug', discussionId = ':discussionId') =>
    `/problems/${slug}/discussions/${discussionId}`,
  submissions: '/submissions',
  submissionDetail: (submissionId = ':submissionId') =>
    `/submissions/${submissionId}`,
  contests: '/contests',
  contestDetail: (contestId = ':contestId') => `/contests/${contestId}`,
  contestScoreboard: (contestId = ':contestId') =>
    `/contests/${contestId}/scoreboard`,
  leaderboard: '/leaderboard',
  profile: '/profile',
  admin: '/admin',
  adminUsers: '/admin/users',
  adminModeration: '/admin/moderation',
  adminAnalytics: '/admin/analytics',
  adminQueue: '/admin/queue',
  adminAuditLogs: '/admin/audit-logs',
} as const;
