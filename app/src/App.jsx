import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Week from './pages/Week'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      supabase.from('categories').select('*').order('created_at').then(({ data }) => {
        if (data) setCategories(data)
      })
    }
  }, [session])

  if (session === undefined) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route
          path="/*"
          element={
            session ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                <Nav user={session.user} />
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/schedule" element={
                      <Week
                        categories={categories}
                        onCategoriesChange={setCategories}
                      />
                    } />
                  </Routes>
                </div>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
