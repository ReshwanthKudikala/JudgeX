import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AuthGateway } from '@/routes/AuthGateway';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { AdminRoute } from '@/routes/AdminRoute';
import { paths } from '@/routes/paths';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProblemsPage } from '@/pages/ProblemsPage';
import { ProblemDetailPage } from '@/pages/ProblemDetailPage';
import { DiscussionDetailPage } from '@/pages/DiscussionDetailPage';
import { SubmissionsPage } from '@/pages/SubmissionsPage';
import { SubmissionDetailPage } from '@/pages/SubmissionDetailPage';
import { ContestsPage } from '@/pages/ContestsPage';
import { ContestDetailPage } from '@/pages/ContestDetailPage';
import { ContestScoreboardPage } from '@/pages/ContestScoreboardPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminModerationPage } from '@/pages/AdminModerationPage';
import { AdminAnalyticsPage } from '@/pages/AdminAnalyticsPage';
import { AdminQueuePage } from '@/pages/AdminQueuePage';
import { AdminAuditLogsPage } from '@/pages/AdminAuditLogsPage';
import { AdminLayout } from '@/features/admin';
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
          {
            path: paths.discussionDetail(),
            element: <DiscussionDetailPage />,
          },
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
              {
                element: <AdminRoute />,
                children: [
                  {
                    element: <AdminLayout />,
                    children: [
                      { path: paths.admin, element: <AdminDashboardPage /> },
                      { path: paths.adminUsers, element: <AdminUsersPage /> },
                      {
                        path: paths.adminModeration,
                        element: <AdminModerationPage />,
                      },
                      {
                        path: paths.adminAnalytics,
                        element: <AdminAnalyticsPage />,
                      },
                      { path: paths.adminQueue, element: <AdminQueuePage /> },
                      {
                        path: paths.adminAuditLogs,
                        element: <AdminAuditLogsPage />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '/404', element: <NotFoundPage /> },
      { path: '*', element: <Navigate to="/404" replace /> },
    ],
  },
]);
