import { createBrowserRouter, RouterProvider, Outlet, ScrollRestoration } from 'react-router-dom'
import { lazy, Suspense, useState, useMemo } from 'react'
const MembersPage = lazy(() => import('@/pages/Members').then((m) => ({ default: m.MembersPage })))
const MemberDetailPage = lazy(() => import('@/pages/MemberDetail').then((m) => ({ default: m.MemberDetailPage })))
const MemberFormPage = lazy(() => import('@/pages/MemberForm').then((m) => ({ default: m.MemberFormPage })))
const PlansPage = lazy(() => import('@/pages/Plans').then((m) => ({ default: m.PlansPage })))
const AttendancePage = lazy(() => import('@/pages/Attendance').then((m) => ({ default: m.AttendancePage })))
const PaymentsPage = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })))
const InvoicePage = lazy(() => import('@/pages/Invoice').then((m) => ({ default: m.InvoicePage })))
const TrainersPage = lazy(() => import('@/pages/Trainers').then((m) => ({ default: m.TrainersPage })))
const TrainerDetailPage = lazy(() => import('@/pages/TrainerDetail').then((m) => ({ default: m.TrainerDetailPage })))
const ExpensesPage = lazy(() => import('@/pages/Expenses').then((m) => ({ default: m.ExpensesPage })))
const FollowUpsPage = lazy(() => import('@/pages/FollowUps').then((m) => ({ default: m.FollowUpsPage })))
const ReportsPage = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const SessionsPage = lazy(() => import('@/pages/Sessions').then((m) => ({ default: m.SessionsPage })))
const EquipmentPage = lazy(() => import('@/pages/Equipment').then((m) => ({ default: m.EquipmentPage })))
const WorkoutsPage = lazy(() => import('@/pages/Workouts').then((m) => ({ default: m.WorkoutsPage })))
const WorkoutPrintPage = lazy(() => import('@/pages/WorkoutPrint').then((m) => ({ default: m.WorkoutPrintPage })))
const ActivityPage = lazy(() => import('@/pages/Activity').then((m) => ({ default: m.ActivityPage })))
import { AppProvider, HeaderContext, useApp, type PageMeta } from './AppContext'
import { Shell } from './Shell'
import { Dashboard } from '@/pages/Dashboard'
import { NotFound } from '@/pages/NotFound'
import { Onboarding } from '@/pages/Onboarding'
import { StorageProblem } from '@/pages/StorageProblem'
import { ToastProvider } from '@/components/ui/Toast'
import { PageLoading } from '@/components/ui/Spinner'
import { ErrorPage } from '@/pages/ErrorPage'

function Root() {
  const [meta, setMeta] = useState<PageMeta>({ title: '' })
  const header = useMemo(() => ({ meta, setMeta }), [meta])
  return (
    <ToastProvider>
      <ScrollRestoration />
      <AppProvider fallback={<PageLoading label="Opening GymBook…" />} onStorageError={(err, retry) => <StorageProblem error={err} retry={retry} />}>
        <HeaderContext.Provider value={header}>
          <Gate />
        </HeaderContext.Provider>
      </AppProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { settings } = useApp()
  if (settings.dataMode === 'unset') return <Onboarding />
  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <Shell />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/members', element: <MembersPage /> },
          { path: '/members/new', element: <MemberFormPage mode="new" /> },
          { path: '/members/:id', element: <MemberDetailPage /> },
          { path: '/members/:id/edit', element: <MemberFormPage mode="edit" /> },
          { path: '/plans', element: <PlansPage /> },
          { path: '/attendance', element: <AttendancePage /> },
          { path: '/payments', element: <PaymentsPage /> },
          { path: '/trainers', element: <TrainersPage /> },
          { path: '/trainers/:id', element: <TrainerDetailPage /> },
          { path: '/expenses', element: <ExpensesPage /> },
          { path: '/follow-ups', element: <FollowUpsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/sessions', element: <SessionsPage /> },
          { path: '/equipment', element: <EquipmentPage /> },
          { path: '/workouts', element: <WorkoutsPage /> },
          { path: '/activity', element: <ActivityPage /> },
        ],
      },
      { path: '/invoices/:id', element: <InvoicePage /> },
      { path: '/workouts/:id/print', element: <WorkoutPrintPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
