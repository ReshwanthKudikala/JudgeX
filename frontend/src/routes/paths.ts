export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  problems: '/problems',
  /** Detail route uses the problem slug (backend resource key). */
  problemDetail: (slug = ':slug') => `/problems/${slug}`,
  submissions: '/submissions',
  submissionDetail: (submissionId = ':submissionId') =>
    `/submissions/${submissionId}`,
  leaderboard: '/leaderboard',
  profile: '/profile',
} as const;
