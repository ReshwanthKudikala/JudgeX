export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  problems: '/problems',
  /** Detail route uses the problem slug (backend resource key). */
  problemDetail: (slug = ':problemId') => `/problems/${slug}`,
  leaderboard: '/leaderboard',
  profile: '/profile',
} as const;
