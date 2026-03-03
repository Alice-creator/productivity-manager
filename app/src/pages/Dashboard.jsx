import { useState, useEffect, useMemo, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import supabase from '../lib/supabase'
import { T } from '../theme'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const UNIT_DEFAULTS = { week: 8, month: 6, year: 3 }

// ─── Shared chart styles ─────────────────────────────────────────────────────

const tickStyle = { fontSize: 12, fill: T.textSub }
const axisLine = { stroke: T.border }
const gridStroke = T.borderStrong
const tooltipStyle = { background: T.surface, border: `1px solid ${T.borderStrong}`, borderRadius: 6, color: T.text, fontSize: 12 }
const legendStyle = { fontSize: 12, color: T.textSub }

const FALLBACK_CATEGORY = { id: '__all', name: 'All', color: T.accent }
function catsOrFallback(categories) {
  return categories.length > 0 ? categories : [FALLBACK_CATEGORY]
}

function dur(t) {
  const [sh, sm] = t.start_time.split(':').map(Number)
  const [eh, em] = t.end_time.split(':').map(Number)
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60
}

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
    if (t.status === 'done') dateMap[t.date].done++
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
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
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
  const [selectedCatIds, setSelectedCatIds] = useState(null) // null = all
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const catDropdownRef = useRef(null)

  function switchUnit(u) {
    const def = UNIT_DEFAULTS[u]
    setUnit(u)
    setN(def)
    setNInput(String(def))
  }

  useEffect(() => {
    function handleClick(e) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) setCatDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCategories = useMemo(() => {
    if (!selectedCatIds) return categories
    return categories.filter(c => selectedCatIds.includes(c.id))
  }, [categories, selectedCatIds])

  function toggleCat(id) {
    setSelectedCatIds(prev => {
      if (!prev) return categories.filter(c => c.id !== id).map(c => c.id)
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      return next.length === categories.length ? null : next
    })
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
      if (data) setTasks(data)
      const { data: pending } = await supabase.from('tasks').select('id, date, status').neq('status', 'done')
      if (pending) setPendingTasks(pending)
      const allIds = [...new Set([...(data || []).map(t => t.id), ...(pending || []).map(t => t.id)])]
      if (allIds.length > 0) {
        const { data: tcData } = await supabase.from('task_categories').select('*').in('task_id', allIds)
        if (tcData) {
          const map = {}
          tcData.forEach(tc => {
            if (!map[tc.task_id]) map[tc.task_id] = []
            map[tc.task_id].push(tc.category_id)
          })
          setTaskCatMap(map)
        }
      }
      const { data: cats } = await supabase.from('categories').select('*').order('created_at')
      if (cats) setCategories(cats)
      setLoading(false)
    }
    load()
  }, [])

  const thisWeekData = useMemo(() => {
    const monday = getMondayOfWeek(new Date())
    return DAYS.map((day, i) => {
      const d = new Date(monday); d.setDate(d.getDate() + i)
      const dayTasks = tasks.filter(t => t.date === isoDate(d))
      const done = dayTasks.filter(t => t.status === 'done').length
      return { day, done, total: dayTasks.length }
    })
  }, [tasks])

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
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
          <button key={u} onClick={() => switchUnit(u)} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${unit === u ? T.accent : T.border}`, background: unit === u ? T.accentSoft : 'transparent', color: unit === u ? T.accent : T.textSub, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
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
        {categories.length > 0 && (
          <>
            <span style={{ color: T.borderStrong, margin: '0 4px', fontSize: 16 }}>·</span>
            <div ref={catDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setCatDropdownOpen(o => !o)}
                style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${selectedCatIds ? T.accent : T.border}`, background: selectedCatIds ? T.accentSoft : 'transparent', color: selectedCatIds ? T.accent : T.textSub, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                {selectedCatIds ? `${selectedCatIds.length} categor${selectedCatIds.length === 1 ? 'y' : 'ies'}` : 'All categories'}
              </button>
              {catDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: T.surface, border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: '8px 0', minWidth: 200, maxHeight: 300, overflowY: 'auto', zIndex: 20 }}>
                  <button
                    onClick={() => setSelectedCatIds(null)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'transparent', border: 'none', color: !selectedCatIds ? T.accent : T.textSub, fontSize: 12, cursor: 'pointer', fontWeight: !selectedCatIds ? 600 : 400 }}
                  >
                    Select all
                  </button>
                  <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
                  {categories.map(cat => {
                    const checked = !selectedCatIds || selectedCatIds.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        onClick={() => toggleCat(cat.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 14px', background: 'transparent', border: 'none', color: checked ? T.text : T.textDim, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? cat.color : T.textDim}`, background: checked ? cat.color : 'transparent', flexShrink: 0 }} />
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stat row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Card style={{ flex: 1, padding: '16px 20px' }}>
            <StatBadge label="Total tasks" value={totalTasks} color={T.text} />
          </Card>
          <Card style={{ flex: 1, padding: '16px 20px' }}>
            <StatBadge label="Completed" value={doneTasks} color={T.success} />
          </Card>
          <Card style={{ flex: 1, padding: '16px 20px' }}>
            <StatBadge label="Overall rate" value={`${overallRate}%`} color={T.accent} />
          </Card>
          <Card style={{ flex: 1, padding: '16px 20px' }}>
            <StatBadge label="This week" value={`${thisWeekDone}/${thisWeekTotal}`} color={T.purple} />
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card title="Completion by day of week">
            <CompletionByDayChart tasks={tasks} n={n} unit={unit} />
          </Card>
          <Card title="Completion trend">
            <TrendChart tasks={tasks} categories={filteredCategories} taskCatMap={taskCatMap} n={n} unit={unit} />
          </Card>
        </div>

        <Card title="Scheduled hours by day of week">
          <TimeDistChart tasks={tasks} categories={filteredCategories} taskCatMap={taskCatMap} n={n} unit={unit} />
        </Card>

        <Card title="Activity streak">
          <StreakCalendar tasks={tasks} n={n} unit={unit} />
        </Card>

        <Card title="Task completion over time">
          <CompletionTimelineChart tasks={tasks} n={n} unit={unit} />
        </Card>

        <Card title="Pending task aging">
          <TaskAgingChart pendingTasks={pendingTasks} categories={filteredCategories} taskCatMap={taskCatMap} n={n} unit={unit} />
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
      const done = dayTasks.filter(t => t.status === 'done').length
      const total = dayTasks.length
      return { day, done, total, rate: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
  }, [tasks, n, unit])
  if (data.every(d => d.total === 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ ...tickStyle, fontSize: 13 }} axisLine={axisLine} tickLine={false} />
        <YAxis tick={tickStyle} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => `${v}%`} contentStyle={tooltipStyle} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.rate >= 80 ? T.success : entry.rate >= 50 ? T.accent : entry.rate > 0 ? T.warning : T.border} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TrendChart({ tasks, categories, taskCatMap, n, unit }) {
  const { data, catKeys } = useMemo(() => {
    const buckets = buildTimeBuckets(n, unit)
    const cats = catsOrFallback(categories)
    const rows = buckets.map(({ label, match }) => {
      const wt = tasks.filter(t => match(t))
      const row = { label }
      cats.forEach(cat => {
        let catTasks, catDone
        if (cat.id === '__all') {
          catTasks = wt
          catDone = wt.filter(t => t.status === 'done')
        } else {
          catTasks = wt.filter(t => taskCatMap[t.id]?.includes(cat.id))
          catDone = catTasks.filter(t => t.status === 'done')
        }
        row[cat.name] = catTasks.length > 0 ? Math.round((catDone.length / catTasks.length) * 100) : 0
      })
      return row
    })
    return { data: rows, catKeys: cats.map(c => ({ name: c.name, color: c.color })) }
  }, [tasks, categories, taskCatMap, n, unit])
  if (data.every(d => catKeys.every(c => d[c.name] === 0))) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 11 }} axisLine={axisLine} tickLine={false} />
        <YAxis tick={tickStyle} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v}%`} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        {catKeys.map(c => (
          <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={{ r: 3, fill: c.color }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function TimeDistChart({ tasks, categories, taskCatMap, n, unit }) {
  const { data, catKeys } = useMemo(() => {
    const filtered = filterLastN(tasks, n, unit).filter(t => t.start_time && t.end_time)
    const cats = catsOrFallback(categories)
    const rows = DAYS.map((day, i) => {
      const dayTasks = filtered.filter(t => {
        const dow = new Date(t.date + 'T00:00:00').getDay()
        return (dow === 0 ? 6 : dow - 1) === i
      })
      const row = { day }
      cats.forEach(cat => {
        const ct = cat.id === '__all' ? dayTasks : dayTasks.filter(t => taskCatMap[t.id]?.includes(cat.id))
        row[cat.name] = parseFloat(ct.reduce((a, t) => a + dur(t), 0).toFixed(1))
      })
      return row
    })
    return { data: rows, catKeys: cats.map(c => ({ name: c.name, color: c.color })) }
  }, [tasks, categories, taskCatMap, n, unit])
  if (data.every(d => catKeys.every(c => d[c.name] === 0))) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ ...tickStyle, fontSize: 13 }} axisLine={axisLine} tickLine={false} />
        <YAxis tick={tickStyle} unit="h" axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => `${v}h`} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        {catKeys.map((c, i) => (
          <Bar key={c.name} dataKey={c.name} stackId="a" fill={c.color} radius={i === catKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function StreakCalendar({ tasks, n, unit }) {
  const numWeeks = toStreakWeeks(n, unit)
  const data = useMemo(() => buildStreakData(tasks, numWeeks), [tasks, numWeeks])
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
                  style={{ flex: 1, height: cellH, borderRadius: 3, background: T.bg, border: future ? '1px solid transparent' : `1px solid ${T.borderStrong}`, position: 'relative', overflow: 'hidden' }}
                >
                  {!future && total > 0 && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${ratio * 100}%`, background: T.streak, borderRadius: 3 }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: T.textSub }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.bg, border: `1px solid ${T.borderStrong}` }} /> No tasks
        <div style={{ width: 12, height: 12, borderRadius: 2, background: T.streak }} /> Done
      </div>
    </div>
  )
}

function CompletionTimelineChart({ tasks, n, unit }) {
  const data = useMemo(() => {
    return buildTimeBuckets(n, unit).map(({ label, match }) => {
      const wt = tasks.filter(t => match(t))
      return { label, total: wt.length, done: wt.filter(t => t.status === 'done').length }
    })
  }, [tasks, n, unit])
  if (!data.some(d => d.total > 0)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 11 }} axisLine={axisLine} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        <Line type="monotone" dataKey="total" name="Scheduled" stroke={T.accent} strokeWidth={2} dot={{ r: 3, fill: T.accent }} />
        <Line type="monotone" dataKey="done" name="Completed" stroke={T.success} strokeWidth={2} dot={{ r: 3, fill: T.success }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

const AGING_BUCKETS = [
  { label: 'Today', min: 0, max: 0 },
  { label: '1–3 days', min: 1, max: 3 },
  { label: '4–7 days', min: 4, max: 7 },
  { label: '1–2 weeks', min: 8, max: 14 },
  { label: '2+ weeks', min: 15, max: Infinity },
]

function TaskAgingChart({ pendingTasks, categories, taskCatMap, n, unit }) {
  const { data, catKeys } = useMemo(() => {
    const filtered = filterLastN(pendingTasks, n, unit).filter(t => t.status !== 'done' && t.date)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const cats = catsOrFallback(categories)
    const rows = AGING_BUCKETS.map(({ label, min, max }) => {
      const bucketTasks = filtered.filter(t => {
        const diff = Math.floor((today - new Date(t.date + 'T00:00:00')) / 86400000)
        return diff >= 0 && diff >= min && diff <= max
      })
      const row = { label }
      cats.forEach(cat => {
        const ct = cat.id === '__all' ? bucketTasks : bucketTasks.filter(t => taskCatMap[t.id]?.includes(cat.id))
        row[cat.name] = ct.length
      })
      return row
    })
    return { data: rows, catKeys: cats.map(c => ({ name: c.name, color: c.color })) }
  }, [pendingTasks, categories, taskCatMap, n, unit])
  if (data.every(d => catKeys.every(c => d[c.name] === 0))) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="label" tick={{ ...tickStyle, fontSize: 11 }} axisLine={axisLine} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        {catKeys.map(c => (
          <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={{ r: 3, fill: c.color }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
