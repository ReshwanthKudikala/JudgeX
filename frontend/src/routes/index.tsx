import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AuthGateway } from '@/routes/AuthGateway';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { AdminRoute } from '@/routes/AdminRoute';
import { LazyRoute } from '@/routes/LazyRoute';
import { paths } from '@/routes/paths';
import { AuthLayout } from '@/layouts/AuthLayout';
import { MainLayout } from '@/layouts/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ProblemsPage = lazy(() =>
  import('@/pages/ProblemsPage').then((m) => ({ default: m.ProblemsPage })),
);
const ProblemDetailPage = lazy(() =>
  import('@/pages/ProblemDetailPage').then((m) => ({ default: m.ProblemDetailPage })),
);
const DiscussionDetailPage = lazy(() =>
  import('@/pages/DiscussionDetailPage').then((m) => ({
    default: m.DiscussionDetailPage,
  })),
);
const SubmissionsPage = lazy(() =>
  import('@/pages/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })),
);
const SubmissionDetailPage = lazy(() =>
  import('@/pages/SubmissionDetailPage').then((m) => ({
    default: m.SubmissionDetailPage,
  })),
);
const ContestsPage = lazy(() =>
  import('@/pages/ContestsPage').then((m) => ({ default: m.ContestsPage })),
);
const ContestDetailPage = lazy(() =>
  import('@/pages/ContestDetailPage').then((m) => ({ default: m.ContestDetailPage })),
);
const ContestScoreboardPage = lazy(() =>
  import('@/pages/ContestScoreboardPage').then((m) => ({
    default: m.ContestScoreboardPage,
  })),
);
const LeaderboardPage = lazy(() =>
  import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('@/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminModerationPage = lazy(() =>
  import('@/pages/AdminModerationPage').then((m) => ({
    default: m.AdminModerationPage,
  })),
);
const AdminAnalyticsPage = lazy(() =>
  import('@/pages/AdminAnalyticsPage').then((m) => ({
    default: m.AdminAnalyticsPage,
  })),
);
const AdminQueuePage = lazy(() =>
  import('@/pages/AdminQueuePage').then((m) => ({ default: m.AdminQueuePage })),
);
const AdminAuditLogsPage = lazy(() =>
  import('@/pages/AdminAuditLogsPage').then((m) => ({
    default: m.AdminAuditLogsPage,
  })),
);
const AdminLayout = lazy(() =>
  import('@/features/admin').then((m) => ({ default: m.AdminLayout })),
);

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
          {
            path: paths.home,
            element: (
              <LazyRoute>
                <DashboardPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.problems,
            element: (
              <LazyRoute>
                <ProblemsPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.discussionDetail(),
            element: (
              <LazyRoute>
                <DiscussionDetailPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.problemDetail(),
            element: (
              <LazyRoute>
                <ProblemDetailPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.contests,
            element: (
              <LazyRoute>
                <ContestsPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.contestScoreboard(),
            element: (
              <LazyRoute>
                <ContestScoreboardPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.contestDetail(),
            element: (
              <LazyRoute>
                <ContestDetailPage />
              </LazyRoute>
            ),
          },
          {
            path: paths.leaderboard,
            element: (
              <LazyRoute>
                <LeaderboardPage />
              </LazyRoute>
            ),
          },
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: paths.submissions,
                element: (
                  <LazyRoute>
                    <SubmissionsPage />
                  </LazyRoute>
                ),
              },
              {
                path: paths.submissionDetail(),
                element: (
                  <LazyRoute>
                    <SubmissionDetailPage />
                  </LazyRoute>
                ),
              },
              {
                path: paths.profile,
                element: (
                  <LazyRoute>
                    <ProfilePage />
                  </LazyRoute>
                ),
              },
              {
                element: <AdminRoute />,
                children: [
                  {
                    element: (
                      <LazyRoute>
                        <AdminLayout />
                      </LazyRoute>
                    ),
                    children: [
                      {
                        path: paths.admin,
                        element: (
                          <LazyRoute>
                            <AdminDashboardPage />
                          </LazyRoute>
                        ),
                      },
                      {
                        path: paths.adminUsers,
                        element: (
                          <LazyRoute>
                            <AdminUsersPage />
                          </LazyRoute>
                        ),
                      },
                      {
                        path: paths.adminModeration,
                        element: (
                          <LazyRoute>
                            <AdminModerationPage />
                          </LazyRoute>
                        ),
                      },
                      {
                        path: paths.adminAnalytics,
                        element: (
                          <LazyRoute>
                            <AdminAnalyticsPage />
                          </LazyRoute>
                        ),
                      },
                      {
                        path: paths.adminQueue,
                        element: (
                          <LazyRoute>
                            <AdminQueuePage />
                          </LazyRoute>
                        ),
                      },
                      {
                        path: paths.adminAuditLogs,
                        element: (
                          <LazyRoute>
                            <AdminAuditLogsPage />
                          </LazyRoute>
                        ),
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
