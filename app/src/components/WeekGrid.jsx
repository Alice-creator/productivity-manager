const HOUR_START = 6
const HOUR_END = 22
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const HOUR_HEIGHT = 64
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function getTaskTop(startTime) {
  const mins = timeToMinutes(startTime)
  return ((mins - HOUR_START * 60) / 60) * HOUR_HEIGHT
}

function getTaskHeight(startTime, endTime) {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max((duration / 60) * HOUR_HEIGHT, 16)
}

export default function WeekGrid({ days, tasks, onSlotClick, onToggleDone }) {
  function getTasksForDay(date) {
    const dateStr = date.toISOString().split('T')[0]
    return tasks.filter(t => t.date === dateStr && t.start_time && t.end_time)
  }

  function handleColumnClick(e, dateStr) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMins = HOUR_START * 60 + Math.floor((y / HOUR_HEIGHT) * 60)
    const snapped = Math.round(totalMins / 15) * 15
    const h = Math.floor(snapped / 60).toString().padStart(2, '0')
    const m = (snapped % 60).toString().padStart(2, '0')
    onSlotClick(dateStr, `${h}:${m}`)
  }

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {/* Time labels */}
      <div style={{ width: 56, flexShrink: 0, paddingTop: 41 }}>
        {HOURS.map(h => (
          <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4, fontSize: 11, color: '#9ca3af' }}>
            {`${h.toString().padStart(2, '0')}:00`}
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((date, i) => {
        const isToday = date.toDateString() === new Date().toDateString()
        const dayTasks = getTasksForDay(date)
        const dateStr = date.toISOString().split('T')[0]

        return (
          <div key={i} style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #e5e7eb' }}>
            {/* Day header */}
            <div style={{ height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #e5e7eb', background: isToday ? '#eff6ff' : 'white', position: 'sticky', top: 0, zIndex: 1 }}>
              <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAYS[i]}</span>
              <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? '#2563eb' : '#111827' }}>{date.getDate()}</span>
            </div>

            {/* Clickable time slots */}
            <div
              style={{ position: 'relative', height: HOURS.length * HOUR_HEIGHT, cursor: 'crosshair' }}
              onClick={(e) => handleColumnClick(e, dateStr)}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT, borderTop: '1px solid #f3f4f6' }} />
              ))}

              {/* Tasks */}
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  onClick={(e) => { e.stopPropagation(); onToggleDone(task) }}
                  title={`${task.start_time} – ${task.end_time}\nClick to toggle done`}
                  style={{
                    position: 'absolute',
                    top: getTaskTop(task.start_time),
                    height: getTaskHeight(task.start_time, task.end_time),
                    left: 2,
                    right: 2,
                    background: task.done ? '#d1fae5' : '#dbeafe',
                    border: `1px solid ${task.done ? '#6ee7b7' : '#93c5fd'}`,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    color: task.done ? '#065f46' : '#1e40af',
                    textDecoration: task.done ? 'line-through' : 'none',
                    userSelect: 'none',
                  }}
                >
                  {task.title}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
