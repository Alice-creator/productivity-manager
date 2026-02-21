import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import WeekGrid from '../components/WeekGrid'
import Drawer from '../components/Drawer'
import { T } from '../theme'

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

export default function Week({ categories, onCategoriesChange }) {
  const [weekStart, setWeekStart] = useState(getMondayOfWeek(new Date()))
  const [tasks, setTasks] = useState([])
  const [taskCatMap, setTaskCatMap] = useState({})
  const [taskVersion, setTaskVersion] = useState(0)
  const [drawerSlot, setDrawerSlot] = useState(null)
  const [editTask, setEditTask] = useState(null)

  const days = getWeekDays(weekStart)

  useEffect(() => {
    fetchTasks()
  }, [weekStart, taskVersion])

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

  async function handleTaskMove(taskId, newDate, newStartTime, newEndTime) {
    // Optimistic update — move task instantly in UI
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, date: newDate, start_time: newStartTime, end_time: newEndTime }
        : t
    ))
    // Persist to database in background
    await supabase.from('tasks').update({ date: newDate, start_time: newStartTime, end_time: newEndTime }).eq('id', taskId)
  }

  async function fetchTasks() {
    const from = days[0].toISOString().split('T')[0]
    const to = days[6].toISOString().split('T')[0]
    const { data } = await supabase.from('tasks').select('*').gte('date', from).lte('date', to)
    if (data) {
      setTasks(data)
      // Fetch category mappings for these tasks
      const ids = data.map(t => t.id)
      if (ids.length > 0) {
        const { data: tcData } = await supabase.from('task_categories').select('*').in('task_id', ids)
        if (tcData) {
          const map = {}
          tcData.forEach(tc => {
            if (!map[tc.task_id]) map[tc.task_id] = []
            map[tc.task_id].push(tc.category_id)
          })
          setTaskCatMap(map)
        }
      } else {
        setTaskCatMap({})
      }
    }
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

  return (
    <div style={{ height: '100%', display: 'flex', fontFamily: 'system-ui, sans-serif', background: T.bg }}>
      <Drawer
        slot={drawerSlot}
        editTask={editTask}
        categories={categories}
        onCategoriesChange={onCategoriesChange}
        onTaskChanged={handleTaskChanged}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={prevWeek} style={navBtn}>←</button>
          <button onClick={nextWeek} style={navBtn}>→</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: T.text }}>{formatRange(days)}</span>
          <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))} style={{ ...navBtn, marginLeft: 4, fontSize: 13 }}>Today</button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <WeekGrid
            days={days}
            tasks={tasks}
            categories={categories}
            taskCatMap={taskCatMap}
            onSlotClick={handleSlotClick}
            onTaskClick={(task) => handleTaskClick(task, taskCatMap[task.id] || [])}
            onTaskMove={handleTaskMove}
          />
        </div>
      </div>
    </div>
  )
}

const navBtn = {
  padding: '4px 10px',
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 4,
  background: T.elevated,
  color: T.text,
  cursor: 'pointer',
  fontSize: 14,
}
