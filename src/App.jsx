import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { FullPageLoader } from './components/ui.jsx'
import Layout from './components/Layout.jsx'
import AdminLayout from './components/AdminLayout.jsx'

import Login from './pages/Login.jsx'
import Enrollment from './pages/teacher/Enrollment.jsx'
import TeacherHome from './pages/teacher/Home.jsx'
import Scan from './pages/teacher/Scan.jsx'
import History from './pages/teacher/History.jsx'

import Dashboard from './pages/admin/Dashboard.jsx'
import Logs from './pages/admin/Logs.jsx'
import ReviewQueue from './pages/admin/ReviewQueue.jsx'
import Teachers from './pages/admin/Teachers.jsx'
import Rooms from './pages/admin/Rooms.jsx'
import Schedules from './pages/admin/Schedules.jsx'
import Reports from './pages/admin/Reports.jsx'

function TeacherRoutes() {
  const { isEnrolled } = useAuth()
  // A teacher cannot scan until enrolled + consented (spec §6.1).
  return (
    <Layout>
      <Routes>
        <Route path="/" element={isEnrolled ? <TeacherHome /> : <Navigate to="/enroll" replace />} />
        <Route path="/enroll" element={isEnrolled ? <Navigate to="/" replace /> : <Enrollment />} />
        <Route path="/scan" element={isEnrolled ? <Scan /> : <Navigate to="/enroll" replace />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function AdminRoutes() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/logs" element={<Logs />} />
        <Route path="/admin/review" element={<ReviewQueue />} />
        <Route path="/admin/teachers" element={<Teachers />} />
        <Route path="/admin/rooms" element={<Rooms />} />
        <Route path="/admin/schedules" element={<Schedules />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  )
}

export default function App() {
  const { loading, session, role } = useAuth()

  if (loading) return <FullPageLoader />

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (role === 'admin' || role === 'super_admin') return <AdminRoutes />
  if (role === 'teacher') return <TeacherRoutes />

  // Signed in but not linked to a teacher or admin record yet.
  return (
    <div className="mx-auto mt-24 max-w-md px-4 text-center">
      <h1 className="text-lg font-semibold">Account not linked</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your login isn’t associated with a teacher or admin record yet. Please
        contact the HR / Dean’s office to complete setup.
      </p>
    </div>
  )
}
