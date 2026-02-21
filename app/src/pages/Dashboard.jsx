import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import supabase from '../lib/supabase'
import { T } from '../theme'

const THEME = T.bg
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

// Last N weeks of Mondays
function getLastNMondays(n) {
  const mondays = []
  let d = getMondayOfWeek(new Date())
  for (let i = 0; i < n; i++) {
    mondays.unshift(new Date(d))
    d.setDate(d.getDate() - 7)
  }
  return mondays
}

// Build 8-week streak data (each cell = one day)
function buildStreakData(tasks) {
  const doneSet = new Set(
    tasks.filter(t => t.done).map(t => t.date)
  )
  const rows = []
  const monday = getMondayOfWeek(new Date())
  for (let week = 7; week >= 0; week--) {
    const weekDates = []
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(monday)
      d.setDate(d.getDate() - week * 7 + dow)
      const dateStr = isoDate(d)
      weekDates.push({ date: dateStr, active: doneSet.has(dateStr), future: d > new Date() })
    }
    rows.push(weekDates)
  }
  return rows
}

// Hourly energy map: count tasks per hour bucket
function buildEnergyMap(tasks) {
  const counts = Array(24).fill(0)
  tasks.forEach(t => {
    if (!t.start_time) return
    const h = parseInt(t.start_time.split(':')[0], 10)
    counts[h]++
  })
  const max = Math.max(...counts, 1)
  return counts.map((c, h) => ({ hour: `${h.toString().padStart(2, '0')}:00`, count: c, intensity: c / max }))
}

// Planned vs actual time for current week
function buildPlannedVsActual(tasks) {
  const monday = getMondayOfWeek(new Date())
  function dur(t) {
    const [sh, sm] = t.start_time.split(':').map(Number)
    const [eh, em] = t.end_time.split(':').map(Number)
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  return DAYS.map((day, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const dateStr = isoDate(d)
    const dayTasks = tasks.filter(t => t.date === dateStr && t.start_time && t.end_time)
    return {
      day,
      planned: parseFloat(dayTasks.reduce((a, t) => a + dur(t), 0).toFixed(1)),
      actual: parseFloat(dayTasks.filter(t => t.done).reduce((a, t) => a + dur(t), 0).toFixed(1)),
    }
  })
}

// Task completion counts per week or month
function buildCompletionTimeline(tasks, view) {
  if (view === 'month') {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const mt = tasks.filter(t => {
        const td = new Date(t.date)
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth()
      })
      return { label, total: mt.length, done: mt.filter(t => t.done).length }
    })
  }
  return getLastNMondays(8).map(monday => {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i); return isoDate(d)
    })
    const wt = tasks.filter(t => weekDates.includes(t.date))
    return { label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), total: wt.length, done: wt.filter(t => t.done).length }
  })
}

// Task aging: how long pending tasks have been waiting
function buildAgingData(tasks) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const buckets = [
    { label: 'Today', min: 0, max: 0, count: 0 },
    { label: '1–3 days', min: 1, max: 3, count: 0 },
    { label: '4–7 days', min: 4, max: 7, count: 0 },
    { label: '1–2 weeks', min: 8, max: 14, count: 0 },
    { label: '2+ weeks', min: 15, max: Infinity, count: 0 },
  ]
  tasks.filter(t => !t.done && t.date).forEach(t => {
    const diff = Math.floor((today - new Date(t.date + 'T00:00:00')) / 86400000)
    if (diff < 0) return
    const b = buckets.find(b => diff >= b.min && diff <= b.max)
    if (b) b.count++
  })
  return buckets
}

function Card({ title, children, style }) {
  return (
    <div style={{ background: T.surface, borderRadius: 10, padding: '20px 24px', border: `2px solid ${T.borderStrong}`, ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  )
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: color || T.text }}>{value}</span>
      <span style={{ fontSize: 13, color: T.textSub }}>{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      sixMonthsAgo.setDate(1)
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .gte('date', isoDate(sixMonthsAgo))
        .order('date', { ascending: true })
      if (data) setTasks(data)
      const { data: pending } = await supabase
        .from('tasks')
        .select('id, date, done')
        .eq('done', false)
      if (pending) setPendingTasks(pending)
      setLoading(false)
    }
    load()
  }, [])

  // --- Derived data ---

  // 1. This-week completion by day
  const thisWeekData = useMemo(() => {
    const monday = getMondayOfWeek(new Date())
    return DAYS.map((day, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      const dateStr = isoDate(d)
      const dayTasks = tasks.filter(t => t.date === dateStr)
      const done = dayTasks.filter(t => t.done).length
      const total = dayTasks.length
      return { day, done, total, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
  }, [tasks])

  // 2. Weekly trend (last 8 weeks completion %)
  const weeklyTrendData = useMemo(() => {
    return getLastNMondays(8).map(monday => {
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday)
        d.setDate(d.getDate() + i)
        return isoDate(d)
      })
      const weekTasks = tasks.filter(t => weekDates.includes(t.date))
      const done = weekTasks.filter(t => t.done).length
      const total = weekTasks.length
      const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { week: label, rate: total > 0 ? Math.round((done / total) * 100) : 0, total }
    })
  }, [tasks])

  // 3. Time distribution by day-of-week (total scheduled minutes)
  const timeDistData = useMemo(() => {
    return DAYS.map((day, i) => {
      const dayTasks = tasks.filter(t => {
        const d = new Date(t.date + 'T00:00:00')
        const dow = d.getDay()
        const mapped = dow === 0 ? 6 : dow - 1
        return mapped === i && t.start_time && t.end_time
      })
      const totalMins = dayTasks.reduce((acc, t) => {
        const [sh, sm] = t.start_time.split(':').map(Number)
        const [eh, em] = t.end_time.split(':').map(Number)
        return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
      }, 0)
      return { day, hours: parseFloat((totalMins / 60).toFixed(1)) }
    })
  }, [tasks])

  // 4. Task title word cloud / top task names (donut by first word)
  const categoryData = useMemo(() => {
    const counts = {}
    tasks.forEach(t => {
      const word = t.title.split(/\s+/)[0]
      counts[word] = (counts[word] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value }))
  }, [tasks])

  // 5. Streak data
  const streakData = useMemo(() => buildStreakData(tasks), [tasks])

  // 6. Energy map
  const energyData = useMemo(() => buildEnergyMap(tasks), [tasks])

  // 7. Planned vs actual
  const plannedVsActualData = useMemo(() => buildPlannedVsActual(tasks), [tasks])

  // 8. Task aging
  const agingData = useMemo(() => buildAgingData(pendingTasks), [pendingTasks])

  // Summary stats
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.done).length
  const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const thisWeekTotal = thisWeekData.reduce((a, d) => a + d.total, 0)
  const thisWeekDone = thisWeekData.reduce((a, d) => a + d.done, 0)

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.textDim }}>Loading...</div>
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: THEME, padding: '20px 24px', borderBottom: `1px solid ${T.border}` }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: T.textSub }}>Your productivity at a glance</p>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
            <StatBadge label="Total tasks" value={totalTasks} color={T.text} />
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
            <StatBadge label="Completed" value={doneTasks} color="#10b981" />
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
            <StatBadge label="Overall rate" value={`${overallRate}%`} color="#3b82f6" />
          </Card>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
            <StatBadge label="This week" value={`${thisWeekDone}/${thisWeekTotal}`} color="#8b5cf6" />
          </Card>
        </div>

        {/* Row 2: this-week bar + weekly trend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="This week — completion by day">
            {thisWeekTotal === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={thisWeekData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#aaa' }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {thisWeekData.map((entry, i) => (
                      <Cell key={i} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#3b82f6' : entry.rate > 0 ? '#f59e0b' : '#1e1e1e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="8-week completion trend">
            {weeklyTrendData.every(d => d.total === 0) ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyTrendData} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#aaa' }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="rate" stroke="#6b9fff" strokeWidth={2} dot={{ r: 3, fill: '#6b9fff' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 3: time per day + task breakdown donut */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="Scheduled hours by day of week">
            {timeDistData.every(d => d.hours === 0) ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeDistData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#aaa' }} unit="h" axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => `${v}h`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card title="Task breakdown (by first word)">
            {categoryData.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 13, color: '#aaa' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Row 4: Streak calendar */}
        <Card title="Activity streak — last 8 weeks">
          {tasks.length === 0 ? (
            <Empty />
          ) : (
            <StreakCalendar data={streakData} />
          )}
        </Card>

        {/* Row 5: Energy map */}
        <Card title="Energy map — tasks by hour">
          {tasks.length === 0 ? (
            <Empty />
          ) : (
            <EnergyMap data={energyData} />
          )}
        </Card>

        {/* Row 6: Planned vs actual */}
        <Card title="This week — planned vs completed time">
          <PlannedVsActualChart data={plannedVsActualData} />
        </Card>

        {/* Row 7: Completion timeline */}
        <Card title="Task completion over time">
          <CompletionTimelineChart tasks={tasks} />
        </Card>

        {/* Row 8: Task aging */}
        <Card title="Pending task aging — how long tasks have been waiting">
          <TaskAgingChart data={agingData} />
        </Card>

      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>No data yet — add tasks in the Week view</div>
}

function StreakCalendar({ data }) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {DAYS.map(d => (
          <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: T.textSub, fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap: 4 }}>
            {week.map(({ date, active, future }) => (
              <div
                key={date}
                title={date}
                style={{
                  flex: 1,
                  height: 20,
                  borderRadius: 3,
                  background: future ? T.bg : active ? T.success : '#2e2e2e',
                  border: date === today ? `2px solid ${T.accent}` : '2px solid transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: T.textSub }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.elevated, border: `1px solid ${T.borderStrong}` }} /> No tasks done
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.success }} /> Tasks done
      </div>
    </div>
  )
}

function EnergyMap({ data }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {data.map(({ hour, count, intensity }) => (
        <div key={hour} title={`${hour}: ${count} task${count !== 1 ? 's' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 4,
            background: count === 0
              ? T.surface
              : `rgba(107,159,255,${0.12 + intensity * 0.88})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: count > 0 ? 600 : 400,
            color: intensity > 0.5 ? T.text : T.textDim,
          }}>
            {count > 0 ? count : ''}
          </div>
          <span style={{ fontSize: 9, color: T.textFaint }}>{hour.slice(0, 2)}</span>
        </div>
      ))}
    </div>
  )
}

function PlannedVsActualChart({ data }) {
  if (!data.some(d => d.planned > 0 || d.actual > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#aaa' }} unit="h" axisLine={false} tickLine={false} />
        <Tooltip formatter={(v, name) => [`${v}h`, name === 'planned' ? 'Planned' : 'Completed']} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
        <Bar dataKey="planned" name="Planned" fill="#6b9fff" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function CompletionTimelineChart({ tasks }) {
  const [view, setView] = useState('week')
  const data = useMemo(() => buildCompletionTimeline(tasks, view), [tasks, view])
  if (!data.some(d => d.total > 0)) return <Empty />
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['week', 'month'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${view === v ? T.accent : T.border}`, background: view === v ? 'rgba(107,159,255,0.15)' : 'transparent', color: view === v ? T.accent : T.textSub, fontSize: 12, cursor: 'pointer' }}>
            {v === 'week' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
          <Line type="monotone" dataKey="total" name="Scheduled" stroke="#6b9fff" strokeWidth={2} dot={{ r: 3, fill: '#6b9fff' }} />
          <Line type="monotone" dataKey="done" name="Completed" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const AGING_COLORS = ['#6b9fff', '#f59e0b', '#ef4444', '#dc2626', '#991b1b']

function TaskAgingChart({ data }) {
  if (!data.some(d => d.count > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} width={70} />
        <Tooltip contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} formatter={(v) => [v, 'Pending tasks']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
