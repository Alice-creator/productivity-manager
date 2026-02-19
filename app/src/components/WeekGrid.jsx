import { useRef, useState } from 'react'

const HOUR_START = 0
const HOUR_END = 24
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const HOUR_HEIGHT = 64
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function getTaskTop(startTime) {
  const mins = timeToMinutes(startTime)
  return ((mins - HOUR_START * 60) / 60) * HOUR_HEIGHT
}

function getTaskHeight(startTime, endTime) {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime)
  return Math.max((duration / 60) * HOUR_HEIGHT, 16)
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function WeekGrid({ days, tasks, categories = [], taskCatMap = {}, onSlotClick, onTaskClick, onTaskMove }) {
  const gridRef = useRef(null)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const wasDragging = useRef(false)
  const rafRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [resize, setResize] = useState(null) // { taskId, startTime, endTime }

  const catById = {}
  categories.forEach(c => { catById[c.id] = c })

  function getTaskColor(task) {
    const catIds = taskCatMap[task.id]
    if (catIds && catIds.length > 0 && catById[catIds[0]]) {
      const color = catById[catIds[0]].color
      return {
        bg: task.done ? hexToRgba(color, 0.15) : hexToRgba(color, 0.2),
        border: task.done ? hexToRgba(color, 0.3) : hexToRgba(color, 0.5),
        text: task.done ? '#6b7280' : color,
      }
    }
    return {
      bg: task.done ? '#d1fae5' : '#dbeafe',
      border: task.done ? '#6ee7b7' : '#93c5fd',
      text: task.done ? '#065f46' : '#1e40af',
    }
  }

  function getTasksForDay(date) {
    const dateStr = date.toISOString().split('T')[0]
    return tasks.filter(t => t.date === dateStr && t.start_time && t.end_time)
  }

  function handleColumnClick(e, dateStr) {
    if (wasDragging.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMins = HOUR_START * 60 + Math.floor((y / HOUR_HEIGHT) * 60)
    const snapped = Math.round(totalMins / 15) * 15
    onSlotClick(dateStr, minsToTime(snapped))
  }

  // --- Drag and drop ---

  function getDropInfo(clientX, clientY) {
    if (!gridRef.current) return null
    const cols = gridRef.current.querySelectorAll('[data-day-col]')
    for (const col of cols) {
      const rect = col.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        const relY = clientY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const clamped = Math.max(0, Math.min(snapped, 23 * 60 + 45))
        return { date: col.dataset.date, time: minsToTime(clamped), rect }
      }
    }
    return null
  }

  function handleTaskMouseDown(e, task) {
    if (e.button !== 0) return
    e.preventDefault()

    const el = e.currentTarget
    const elRect = el.getBoundingClientRect()

    dragRef.current = {
      task,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - elRect.left,
      offsetY: e.clientY - elRect.top,
      width: elRect.width,
      height: elRect.height,
      duration: timeToMinutes(task.end_time) - timeToMinutes(task.start_time),
      started: false,
    }

    function onMove(ev) {
      const d = dragRef.current
      if (!d) return

      if (!d.started) {
        if (Math.abs(ev.clientX - d.startX) + Math.abs(ev.clientY - d.startY) < 5) return
        d.started = true
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      d.lastX = ev.clientX
      d.lastY = ev.clientY
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const dd = dragRef.current
        if (!dd) return

        const drop = getDropInfo(dd.lastX, dd.lastY)

        if (drop) {
          const mins = timeToMinutes(drop.time)
          const snapY = drop.rect.top + ((mins - HOUR_START * 60) / 60) * HOUR_HEIGHT
          setDrag({
            task: dd.task,
            x: drop.rect.left + 2,
            y: snapY,
            w: drop.rect.width - 4,
            h: dd.height,
          })
        } else {
          setDrag({
            task: dd.task,
            x: dd.lastX - dd.offsetX,
            y: dd.lastY - dd.offsetY,
            w: dd.width,
            h: dd.height,
          })
        }
      })
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const d = dragRef.current
      dragRef.current = null
      setDrag(null)

      if (!d || !d.started) return

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)

      const drop = getDropInfo(ev.clientX, ev.clientY)
      if (!drop || !onTaskMove) return

      const startMins = timeToMinutes(drop.time)
      const endMins = Math.min(startMins + d.duration, 24 * 60)

      const oldStart = (d.task.start_time || '').slice(0, 5)
      if (drop.date !== d.task.date || drop.time !== oldStart) {
        onTaskMove(d.task.id, drop.date, drop.time, minsToTime(endMins))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Resize ---

  function handleResizeMouseDown(e, task, edge) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const col = e.target.closest('[data-day-col]')
    if (!col) return

    resizeRef.current = {
      task,
      edge,
      colEl: col,
      startTime: task.start_time.slice(0, 5),
      endTime: task.end_time.slice(0, 5),
    }

    document.body.style.cursor = edge === 'top' ? 'n-resize' : 's-resize'
    document.body.style.userSelect = 'none'

    function onMove(ev) {
      const r = resizeRef.current
      if (!r) return

      r.lastY = ev.clientY
      if (r.raf) return
      r.raf = requestAnimationFrame(() => {
        r.raf = null
        const rr = resizeRef.current
        if (!rr) return

        const rect = rr.colEl.getBoundingClientRect()
        const relY = rr.lastY - rect.top
        const totalMins = HOUR_START * 60 + (relY / HOUR_HEIGHT) * 60
        const snapped = Math.round(totalMins / 15) * 15
        const clamped = Math.max(0, Math.min(snapped, 24 * 60))

        if (rr.edge === 'bottom') {
          const startMins = timeToMinutes(rr.startTime)
          rr.endTime = minsToTime(Math.max(clamped, startMins + 15))
        } else {
          const endMins = timeToMinutes(rr.endTime)
          rr.startTime = minsToTime(Math.min(clamped, endMins - 15))
        }

        setResize({ taskId: rr.task.id, startTime: rr.startTime, endTime: rr.endTime })
      })
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (resizeRef.current?.raf) cancelAnimationFrame(resizeRef.current.raf)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      const r = resizeRef.current
      resizeRef.current = null
      setResize(null)

      if (!r || !onTaskMove) return

      const oldStart = (r.task.start_time || '').slice(0, 5)
      const oldEnd = (r.task.end_time || '').slice(0, 5)
      if (r.startTime !== oldStart || r.endTime !== oldEnd) {
        onTaskMove(r.task.id, r.task.date, r.startTime, r.endTime)
      }

      wasDragging.current = true
      setTimeout(() => { wasDragging.current = false }, 0)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Render ---

  const ghostColors = drag ? getTaskColor(drag.task) : null

  return (
    <div ref={gridRef} style={{ display: 'flex', width: '100%' }}>
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
              data-day-col={i}
              data-date={dateStr}
              style={{ position: 'relative', height: HOURS.length * HOUR_HEIGHT, cursor: 'crosshair' }}
              onClick={(e) => handleColumnClick(e, dateStr)}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} style={{ position: 'absolute', top: (h - HOUR_START) * HOUR_HEIGHT, left: 0, right: 0, height: HOUR_HEIGHT, borderTop: '1px solid #f3f4f6' }} />
              ))}

              {/* Tasks */}
              {dayTasks.map(task => {
                const colors = getTaskColor(task)
                const isDragging = drag && drag.task.id === task.id
                const isResizing = resize && resize.taskId === task.id
                const effStart = isResizing ? resize.startTime : task.start_time
                const effEnd = isResizing ? resize.endTime : task.end_time
                return (
                  <div
                    key={task.id}
                    onMouseDown={(e) => handleTaskMouseDown(e, task)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (wasDragging.current) return
                      onTaskClick(task)
                    }}
                    title={`${task.start_time} – ${task.end_time}\nDrag to move`}
                    style={{
                      position: 'absolute',
                      top: getTaskTop(effStart),
                      height: getTaskHeight(effStart, effEnd),
                      left: 2,
                      right: 2,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderLeft: `3px solid ${colors.border}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 12,
                      overflow: 'hidden',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      color: colors.text,
                      textDecoration: task.done ? 'line-through' : 'none',
                      userSelect: 'none',
                      opacity: isDragging ? 0.3 : 1,
                    }}
                  >
                    {/* Top resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, task, 'top')}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, cursor: 'n-resize' }}
                    />
                    {task.title}
                    {/* Bottom resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeMouseDown(e, task, 'bottom')}
                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, cursor: 's-resize' }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Drag ghost */}
      {drag && ghostColors && (
        <div style={{
          position: 'fixed',
          left: drag.x,
          top: drag.y,
          width: drag.w,
          height: drag.h,
          background: ghostColors.bg,
          border: `1px solid ${ghostColors.border}`,
          borderLeft: `3px solid ${ghostColors.border}`,
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 12,
          color: ghostColors.text,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          opacity: 0.9,
        }}>
          {drag.task.title}
        </div>
      )}
    </div>
  )
}
