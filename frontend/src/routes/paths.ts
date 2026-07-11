export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  problems: '/problems',
  problemDetail: (id = ':problemId') => `/problems/${id}`,
  leaderboard: '/leaderboard',
  profile: '/profile',
} as const;
