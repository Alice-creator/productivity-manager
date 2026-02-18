import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import supabase from '../lib/supabase'

const THEME = 'linear-gradient(45deg, rgba(0,0,0,1) 0%, rgba(126,136,140,1) 50%, rgba(211,234,242,1) 100%)'
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

function Card({ title, children, style }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>{title}</div>}
      {children}
    </div>
  )
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 28, fontWeight: 700, color: color || '#111827' }}>{value}</span>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch last 8 weeks of tasks
      const monday8ago = new Date(getMondayOfWeek(new Date()))
      monday8ago.setDate(monday8ago.getDate() - 7 * 7)
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .gte('date', isoDate(monday8ago))
        .order('date', { ascending: true })
      if (data) setTasks(data)
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

  // Summary stats
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.done).length
  const overallRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const thisWeekTotal = thisWeekData.reduce((a, d) => a + d.total, 0)
  const thisWeekDone = thisWeekData.reduce((a, d) => a + d.done, 0)

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>Loading...</div>
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: THEME, padding: '20px 24px 20px' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Your productivity at a glance</p>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
            <StatBadge label="Total tasks" value={totalTasks} color="#111827" />
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
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {thisWeekData.map((entry, i) => (
                      <Cell key={i} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#3b82f6' : entry.rate > 0 ? '#f59e0b' : '#e5e7eb'} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v) => `${v}h`} />
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
                  <Tooltip />
                  <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
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

      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>No data yet — add tasks in the Week view</div>
}

function StreakCalendar({ data }) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {DAYS.map(d => (
          <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{d}</div>
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
                  background: future ? '#f9fafb' : active ? '#10b981' : '#e5e7eb',
                  border: date === today ? '2px solid #3b82f6' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: '#6b7280' }}>
        <div style={{ width: 12, height: 12, borderRadius: 2, background: '#e5e7eb' }} /> No tasks done
        <div style={{ width: 12, height: 12, borderRadius: 2, background: '#10b981' }} /> Tasks done
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
              ? '#f3f4f6'
              : `rgba(59,130,246,${0.15 + intensity * 0.85})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: count > 0 ? 600 : 400,
            color: intensity > 0.5 ? 'white' : '#374151',
          }}>
            {count > 0 ? count : ''}
          </div>
          <span style={{ fontSize: 9, color: '#9ca3af' }}>{hour.slice(0, 2)}</span>
        </div>
      ))}
    </div>
  )
}
