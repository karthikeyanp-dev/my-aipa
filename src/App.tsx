import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { isConfigured } from './lib/firebase'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import SignIn from './components/SignIn'
import SetupNotice from './components/SetupNotice'
import Splash from './components/Splash'
import Home from './pages/Home'
import Ask from './pages/Ask'
import Settings from './pages/Settings'
import Editor from './pages/Editor'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'ask', element: <Ask /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  { path: '/note/new', element: <Editor /> },
  { path: '/note/:id', element: <Editor /> },
])

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <SignIn />
  return <RouterProvider router={router} />
}

export default function App() {
  if (!isConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
