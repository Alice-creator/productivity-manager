import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import WeekGrid from '../components/WeekGrid'
import TaskModal from '../components/TaskModal'

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function formatRange(days) {
  const start = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

export default function Week() {
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()))
  const [tasks, setTasks] = useState([])
  const [modalSlot, setModalSlot] = useState(null)

  const days = getWeekDays(weekStart)

  useEffect(() => {
    fetchTasks()
  }, [weekStart])

  async function fetchTasks() {
    const from = days[0].toISOString().split('T')[0]
    const to = days[6].toISOString().split('T')[0]
    const { data } = await supabase.from('tasks').select('*').gte('date', from).lte('date', to)
    if (data) setTasks(data)
  }

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  async function handleSaveTask(task) {
    const { data } = await supabase.from('tasks').insert(task).select().single()
    if (data) {
      setTasks(prev => [...prev, data])
      setModalSlot(null)
    }
  }

  async function handleToggleDone(task) {
    const { data } = await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id).select().single()
    if (data) setTasks(prev => prev.map(t => t.id === data.id ? data : t))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <button onClick={prevWeek} style={navBtn}>←</button>
        <button onClick={nextWeek} style={navBtn}>→</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{formatRange(days)}</span>
        <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))} style={{ ...navBtn, marginLeft: 4, fontSize: 13 }}>Today</button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <WeekGrid days={days} tasks={tasks} onSlotClick={(date, time) => setModalSlot({ date, time })} onToggleDone={handleToggleDone} />
      </div>

      {modalSlot && <TaskModal slot={modalSlot} onSave={handleSaveTask} onClose={() => setModalSlot(null)} />}
    </div>
  )
}

const navBtn = {
  padding: '4px 10px',
  border: '1px solid #e5e7eb',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontSize: 14,
}
