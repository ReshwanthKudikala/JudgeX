import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AuthGateway } from '@/routes/AuthGateway';
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
import { SubmissionsPage } from '@/pages/SubmissionsPage';
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage';
import { ContestsPage } from '@/pages/ContestsPage';
import { ContestDetailPage } from '@/pages/ContestDetailPage';
import { ContestScoreboardPage } from '@/pages/ContestScoreboardPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <AuthGateway />,
    children: [
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
          { path: paths.contests, element: <ContestsPage /> },
          {
            path: paths.contestScoreboard(),
            element: <ContestScoreboardPage />,
          },
          { path: paths.contestDetail(), element: <ContestDetailPage /> },
          { path: paths.leaderboard, element: <LeaderboardPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: paths.submissions, element: <SubmissionsPage /> },
              {
                path: paths.submissionDetail(),
                element: <SubmissionDetailPage />,
              },
              { path: paths.profile, element: <ProfilePage /> },
            ],
          },
        ],
      },
      { path: '/404', element: <NotFoundPage /> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
