import AdminRouter from '../../../components/admin/AdminEntry'

export const metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default function AdminPage() {
  return <AdminRouter />
}
