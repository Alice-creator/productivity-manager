import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import supabase from '../lib/supabase'
import { T } from '../theme'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const UNIT_DEFAULTS = { week: 8, month: 6, year: 3 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d) { return d.toISOString().split('T')[0] }

function getLastNMondays(n) {
  const mondays = []
  let d = getMondayOfWeek(new Date())
  for (let i = 0; i < n; i++) {
    mondays.unshift(new Date(d))
    d.setDate(d.getDate() - 7)
  }
  return mondays
}

// Filter tasks to the last N units
function filterLastN(tasks, n, unit) {
  const now = new Date()
  let start
  if (unit === 'week') {
    start = new Date(getMondayOfWeek(now))
    start.setDate(start.getDate() - (n - 1) * 7)
  } else if (unit === 'month') {
    start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  } else {
    start = new Date(now.getFullYear() - (n - 1), 0, 1)
  }
  return tasks.filter(t => t.date >= isoDate(start))
}

// Build time-bucketed groups for trend/timeline charts
function buildTimeBuckets(n, unit) {
  const now = new Date()
  if (unit === 'week') {
    return getLastNMondays(n).map(monday => {
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday); d.setDate(d.getDate() + i); return isoDate(d)
      })
      return {
        label: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        match: t => weekDates.includes(t.date),
      }
    })
  }
  if (unit === 'month') {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
      const next = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i) + 1, 1)
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        match: t => { const td = new Date(t.date + 'T00:00:00'); return td >= d && td < next },
      }
    })
  }
  return Array.from({ length: n }, (_, i) => {
    const year = now.getFullYear() - (n - 1 - i)
    return {
      label: String(year),
      match: t => new Date(t.date + 'T00:00:00').getFullYear() === year,
    }
  })
}

// Convert n + unit to a week count for the streak grid (capped at available data)
function toStreakWeeks(n, unit) {
  if (unit === 'week') return n
  if (unit === 'month') return Math.min(n * 4, 26)
  return Math.min(n * 52, 26)
}

function buildStreakData(tasks, numWeeks) {
  const dateMap = {}
  tasks.forEach(t => {
    if (!dateMap[t.date]) dateMap[t.date] = { done: 0, total: 0 }
    dateMap[t.date].total++
    if (t.done) dateMap[t.date].done++
  })
  const rows = []
  const monday = getMondayOfWeek(new Date())
  for (let week = numWeeks - 1; week >= 0; week--) {
    const weekDates = []
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(monday)
      d.setDate(d.getDate() - week * 7 + dow)
      const dateStr = isoDate(d)
      const { done = 0, total = 0 } = dateMap[dateStr] || {}
      weekDates.push({ date: dateStr, done, total, future: d > new Date() })
    }
    rows.push(weekDates)
  }
  return rows
}

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

// ─── Shared UI ────────────────────────────────────────────────────────────────

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

function Empty() {
  return <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textFaint, fontSize: 13 }}>No data for this period</div>
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [taskCatMap, setTaskCatMap] = useState({})
  const [loading, setLoading] = useState(true)

  const [unit, setUnit] = useState('week')
  const [n, setN] = useState(8)
  const [nInput, setNInput] = useState('8')

  function switchUnit(u) {
    const def = UNIT_DEFAULTS[u]
    setUnit(u)
    setN(def)
    setNInput(String(def))
  }

  function commitN() {
    const max = unit === 'year' ? 10 : unit === 'month' ? 24 : 52
    const v = Math.max(1, Math.min(max, parseInt(nInput) || n))
    setN(v)
    setNInput(String(v))
  }

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      sixMonthsAgo.setDate(1)
      const { data } = await supabase
        .from('tasks').select('*')
        .gte('date', isoDate(sixMonthsAgo))
        .order('date', { ascending: true })
      if (data) {
        setTasks(data)
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
        }
      }
      const { data: cats } = await supabase.from('categories').select('*').order('created_at')
      if (cats) setCategories(cats)
      const { data: pending } = await supabase.from('tasks').select('id, date, done').eq('done', false)
      if (pending) setPendingTasks(pending)
      setLoading(false)
    }
    load()
  }, [])

  const thisWeekData = useMemo(() => {
    const monday = getMondayOfWeek(new Date())
    return DAYS.map((day, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i)
      const dayTasks = tasks.filter(t => t.date === isoDate(d))
      const done = dayTasks.filter(t => t.done).length
      return { day, done, total: dayTasks.length }
    })
  }, [tasks])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.done).length
  const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const thisWeekTotal = thisWeekData.reduce((a, d) => a + d.total, 0)
  const thisWeekDone = thisWeekData.reduce((a, d) => a + d.done, 0)

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.textDim }}>Loading...</div>
  }

  const filterLabel = unit === 'week' ? 'weeks' : unit === 'month' ? 'months' : 'years'
  const unitLabels = { week: 'Weekly', month: 'Monthly', year: 'Yearly' }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>

      {/* Global filter bar */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, background: T.bg, position: 'sticky', top: 0, zIndex: 10 }}>
        {['week', 'month', 'year'].map(u => (
          <button key={u} onClick={() => switchUnit(u)} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${unit === u ? T.accent : T.border}`, background: unit === u ? 'rgba(107,159,255,0.15)' : 'transparent', color: unit === u ? T.accent : T.textSub, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {unitLabels[u]}
          </button>
        ))}
        <span style={{ color: T.borderStrong, margin: '0 4px', fontSize: 16 }}>·</span>
        <span style={{ fontSize: 12, color: T.textSub }}>Last</span>
        <input
          type="text"
          inputMode="numeric"
          value={nInput}
          onChange={e => setNInput(e.target.value)}
          onBlur={commitN}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          style={{ width: 42, padding: '3px 6px', background: T.elevated, border: `1px solid ${T.borderStrong}`, borderRadius: 4, color: T.text, fontSize: 12, textAlign: 'center', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: T.textSub }}>{filterLabel}</span>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="Completion by day of week">
            <CompletionByDayChart tasks={tasks} n={n} unit={unit} />
          </Card>
          <Card title="Completion trend">
            <TrendChart tasks={tasks} n={n} unit={unit} />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="Scheduled hours by day of week">
            <TimeDistChart tasks={tasks} n={n} unit={unit} />
          </Card>
          <Card title="Tasks by categories">
            <CategoryChart tasks={tasks} categories={categories} taskCatMap={taskCatMap} n={n} unit={unit} />
          </Card>
        </div>

        <Card title="Activity streak">
          <StreakCalendar tasks={tasks} n={n} unit={unit} />
        </Card>

        <Card title="Planned vs completed time">
          <PlannedVsActualChart tasks={tasks} n={n} unit={unit} />
        </Card>

        <Card title="Task completion over time">
          <CompletionTimelineChart tasks={tasks} n={n} unit={unit} />
        </Card>

        <Card title="Pending task aging">
          <TaskAgingChart pendingTasks={pendingTasks} n={n} unit={unit} />
        </Card>

      </div>
    </div>
  )
}

// ─── Chart components ─────────────────────────────────────────────────────────

function CompletionByDayChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    const filtered = filterLastN(tasks, n, unit)
    return DAYS.map((day, i) => {
      const dayTasks = filtered.filter(t => {
        const dow = new Date(t.date + 'T00:00:00').getDay()
        return (dow === 0 ? 6 : dow - 1) === i
      })
      const done = dayTasks.filter(t => t.done).length
      const total = dayTasks.length
      return { day, done, total, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
  }, [tasks, n, unit])
  if (data.every(d => d.total === 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#aaa' }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => `${v}%`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#3b82f6' : entry.rate > 0 ? '#f59e0b' : '#1e1e1e'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TrendChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    return buildTimeBuckets(n, unit).map(({ label, match }) => {
      const wt = tasks.filter(t => match(t))
      const done = wt.filter(t => t.done).length
      const total = wt.length
      return { label, rate: total > 0 ? Math.round((done / total) * 100) : 0, total }
    })
  }, [tasks, n, unit])
  if (data.every(d => d.total === 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#aaa' }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Line type="monotone" dataKey="rate" stroke="#6b9fff" strokeWidth={2} dot={{ r: 3, fill: '#6b9fff' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TimeDistChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    const filtered = filterLastN(tasks, n, unit).filter(t => t.start_time && t.end_time)
    return DAYS.map((day, i) => {
      const dayTasks = filtered.filter(t => {
        const dow = new Date(t.date + 'T00:00:00').getDay()
        return (dow === 0 ? 6 : dow - 1) === i
      })
      const totalMins = dayTasks.reduce((acc, t) => {
        const [sh, sm] = t.start_time.split(':').map(Number)
        const [eh, em] = t.end_time.split(':').map(Number)
        return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
      }, 0)
      return { day, hours: parseFloat((totalMins / 60).toFixed(1)) }
    })
  }, [tasks, n, unit])
  if (data.every(d => d.hours === 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#aaa' }} unit="h" axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => `${v}h`} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoryChart({ tasks, categories, taskCatMap, n, unit }) {
  const data = useMemo(() => {
    const filtered = filterLastN(tasks, n, unit)
    return categories
      .map(cat => ({
        name: cat.name,
        color: cat.color,
        value: filtered.filter(t => taskCatMap[t.id]?.includes(cat.id)).length,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [tasks, categories, taskCatMap, n, unit])
  if (data.length === 0) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="45%" cy="50%" outerRadius={75} innerRadius={38} paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 13, color: '#aaa' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function StreakCalendar({ tasks, n, unit }) {
  const numWeeks = toStreakWeeks(n, unit)
  const data = useMemo(() => buildStreakData(tasks, numWeeks), [tasks, numWeeks])
  const today = new Date().toISOString().split('T')[0]
  const cellH = numWeeks > 12 ? 14 : 20
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
            {week.map(({ date, done, total, future }) => {
              const ratio = total > 0 ? done / total : 0
              return (
                <div
                  key={date}
                  title={total > 0 ? `${date}: ${done}/${total} done` : date}
                  style={{ flex: 1, height: cellH, borderRadius: 3, background: future ? T.bg : '#2e2e2e', border: date === today ? `2px solid ${T.accent}` : '2px solid transparent', position: 'relative', overflow: 'hidden' }}
                >
                  {!future && total > 0 && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${ratio * 100}%`, background: T.success }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: T.textSub }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: '#2e2e2e', border: `1px solid ${T.borderStrong}` }} /> No tasks
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.success, opacity: 0.4 }} /> Partial
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.success }} /> All done
      </div>
    </div>
  )
}

function PlannedVsActualChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    function dur(t) {
      const [sh, sm] = t.start_time.split(':').map(Number)
      const [eh, em] = t.end_time.split(':').map(Number)
      return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60
    }
    return buildTimeBuckets(n, unit).map(({ label, match }) => {
      const wt = tasks.filter(t => match(t) && t.start_time && t.end_time)
      return {
        label,
        planned: parseFloat(wt.reduce((a, t) => a + dur(t), 0).toFixed(1)),
        actual: parseFloat(wt.filter(t => t.done).reduce((a, t) => a + dur(t), 0).toFixed(1)),
      }
    })
  }, [tasks, n, unit])
  if (!data.some(d => d.planned > 0 || d.actual > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#aaa' }} unit="h" axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v, name) => [`${v}h`, name === 'planned' ? 'Planned' : 'Completed']} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
        <Bar dataKey="planned" name="Planned" fill="#6b9fff" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function CompletionTimelineChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    return buildTimeBuckets(n, unit).map(({ label, match }) => {
      const wt = tasks.filter(t => match(t))
      return { label, total: wt.length, done: wt.filter(t => t.done).length }
    })
  }, [tasks, n, unit])
  if (!data.some(d => d.total > 0)) return <Empty />
  return (
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
  )
}

const AGING_COLORS = ['#6b9fff', '#f59e0b', '#ef4444', '#dc2626', '#991b1b']

function TaskAgingChart({ pendingTasks, n, unit }) {
  const data = useMemo(() => buildAgingData(filterLastN(pendingTasks, n, unit)), [pendingTasks, n, unit])
  if (!data.some(d => d.count > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 10 }}>
        <XAxis type="number" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#aaa' }} axisLine={false} tickLine={false} width={70} />
        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#111', border: '1px solid #252525', borderRadius: 6, color: '#f0f0f0', fontSize: 12 }} formatter={(v) => [v, 'Pending tasks']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={AGING_COLORS[i]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
