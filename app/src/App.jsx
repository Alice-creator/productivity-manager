import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import supabase from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Week from './pages/Week'
import Nav from './components/Nav'
import Drawer from './components/Drawer'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [categories, setCategories] = useState([])
  const [drawerSlot, setDrawerSlot] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [taskVersion, setTaskVersion] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch categories when logged in
  useEffect(() => {
    if (session) {
      supabase.from('categories').select('*').order('created_at').then(({ data }) => {
        if (data) setCategories(data)
      })
    }
  }, [session])

  function handleSlotClick(date, time) {
    setEditTask(null)
    setDrawerSlot({ date, time, _ts: Date.now() })
  }

  function handleTaskClick(task, categoryIds) {
    setDrawerSlot(null)
    setEditTask({ ...task, category_ids: categoryIds, _ts: Date.now() })
  }

  function handleTaskChanged() {
    setTaskVersion(v => v + 1)
  }

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
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                  <Drawer
                    slot={drawerSlot}
                    editTask={editTask}
                    categories={categories}
                    onCategoriesChange={setCategories}
                    onTaskChanged={handleTaskChanged}
                  />
                  <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/week" element={
                        <Week
                          categories={categories}
                          onSlotClick={handleSlotClick}
                          onTaskClick={handleTaskClick}
                          taskVersion={taskVersion}
                        />
                      } />
                    </Routes>
                  </div>
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
