import { createBrowserRouter, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { paths } from '@/routes/paths';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProblemsPage } from '@/pages/ProblemsPage';
import { ProblemDetailPage } from '@/pages/ProblemDetailPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: paths.login, element: <LoginPage /> },
          { path: paths.register, element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <MainLayout />,
    children: [
      { path: paths.home, element: <DashboardPage /> },
      { path: paths.problems, element: <ProblemsPage /> },
      { path: paths.problemDetail(), element: <ProblemDetailPage /> },
      { path: paths.leaderboard, element: <LeaderboardPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: paths.profile, element: <ProfilePage /> }],
      },
    ],
  },
  { path: '/404', element: <NotFoundPage /> },
  { path: '*', element: <Navigate to="/404" replace /> },
]);
