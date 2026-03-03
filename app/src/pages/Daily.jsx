import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { T } from '../theme'
import { nextStatus } from '../lib/taskStatus'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`
}

export default function Daily({ categories }) {
  const [tasks, setTasks] = useState([])
  const [taskCatMap, setTaskCatMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [todayRes, overdueRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('date', today),
        supabase.from('tasks').select('*').lt('date', today).neq('status', 'done'),
      ])

      const allTasks = [...(todayRes.data || []), ...(overdueRes.data || [])]
      setTasks(allTasks)

      const ids = allTasks.map(t => t.id)
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
      setLoading(false)
    }
    load()
  }, [])

  const catById = {}
  categories.forEach(c => { catById[c.id] = c })

  const todayTasks = tasks
    .filter(t => t.date === today)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  const overdueTasks = tasks
    .filter(t => t.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.start_time || '').localeCompare(b.start_time || ''))

  async function handleCycleStatus(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const next = nextStatus(task.status)
    const update = { status: next }
    if (taskId === selectedTaskId && noteText !== (task.note || '')) {
      update.note = noteText
    }
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...update } : t
    ))
    await Promise.all([
      supabase.from('tasks').update(update).eq('id', taskId),
      supabase.from('status_logs').insert({ task_id: taskId, status: next }),
    ])
  }

  function handleSelectTask(taskId) {
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null)
      setNoteText('')
    } else {
      const task = tasks.find(t => t.id === taskId)
      setSelectedTaskId(taskId)
      setNoteText(task?.note || '')
    }
  }

  async function handleSaveNote() {
    if (!selectedTaskId) return
    setSavingNote(true)
    await supabase.from('tasks').update({ note: noteText }).eq('id', selectedTaskId)
    setTasks(prev => prev.map(t =>
      t.id === selectedTaskId ? { ...t, note: noteText } : t
    ))
    setSavingNote(false)
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.textDim, fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: T.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Main task list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}` }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Daily Tasks</h1>
          <div style={{ fontSize: 13, color: T.textSub, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Overdue section */}
          {overdueTasks.length > 0 && (
            <>
              <SectionHeader label="Overdue" count={overdueTasks.length} color={T.warning} />
              {overdueTasks.map(task => (
                <TaskRow key={task.id} task={task} catById={catById} taskCatMap={taskCatMap} onToggle={handleCycleStatus} onSelect={handleSelectTask} selectedId={selectedTaskId} isOverdue />
              ))}
              <div style={{ height: 20 }} />
            </>
          )}

          {/* Today section */}
          <SectionHeader label="Today" count={todayTasks.length} />
          {todayTasks.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: T.textDim, fontSize: 13 }}>
              No tasks scheduled for today
            </div>
          )}
          {todayTasks.map(task => (
            <TaskRow key={task.id} task={task} catById={catById} taskCatMap={taskCatMap} onToggle={handleCycleStatus} onSelect={handleSelectTask} selectedId={selectedTaskId} />
          ))}

          {/* Global empty state */}
          {todayTasks.length === 0 && overdueTasks.length === 0 && (
            <div style={{ padding: '48px 0', textAlign: 'center', color: T.textDim, fontSize: 14 }}>
              Nothing on your plate — enjoy the day!
            </div>
          )}
        </div>
      </div>

      {/* Note panel */}
      {selectedTask && (
        <NotePanel
          task={selectedTask}
          noteText={noteText}
          setNoteText={setNoteText}
          onSave={handleSaveNote}
          saving={savingNote}
          onClose={() => { setSelectedTaskId(null); setNoteText('') }}
        />
      )}
    </div>
  )
}

function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: color || T.textSub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: color || T.textDim, fontWeight: 600 }}>
        {count}
      </span>
    </div>
  )
}

function TaskRow({ task, catById, taskCatMap, onToggle, onSelect, selectedId, isOverdue }) {
  const catIds = taskCatMap[task.id] || []
  const isSelected = selectedId === task.id

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', marginBottom: 4,
        background: isSelected ? T.elevated : T.surface,
        border: `1px solid ${isSelected ? T.accent : T.borderStrong}`,
        borderRadius: 6, cursor: 'pointer',
      }}
    >
      {/* Status indicator — larger hit area for easy clicking */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(task.id) }}
        style={{
          padding: 6, margin: -6, flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          border: `2px solid ${task.status === 'done' ? T.success : task.status === 'in_progress' ? T.warning : T.borderStrong}`,
          background: task.status === 'done' ? T.successSoft : task.status === 'in_progress' ? T.warningSoft : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {task.status === 'done' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {task.status === 'in_progress' && (
            <div style={{ width: 8, height: 8, borderRadius: 2, background: T.warning }} />
          )}
        </div>
      </div>

      {/* Title + overdue date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14,
          color: task.status === 'done' ? T.textDim : task.status === 'in_progress' ? T.warning : T.text,
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          fontStyle: task.status === 'in_progress' ? 'italic' : 'normal',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {task.title}
        </div>
        {isOverdue && task.status !== 'done' && (
          <div style={{ fontSize: 11, color: T.warning, marginTop: 1 }}>
            {task.date}
          </div>
        )}
      </div>

      {/* Note indicator */}
      {task.note && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )}

      {/* Category dots */}
      {catIds.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {catIds.map(cid => {
            const cat = catById[cid]
            return cat ? (
              <div key={cid} title={cat.name} style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            ) : null
          })}
        </div>
      )}

      {/* Time */}
      {task.start_time && (
        <span style={{ fontSize: 12, color: T.textSub, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {formatTime(task.start_time)}
        </span>
      )}
    </div>
  )
}

function NotePanel({ task, noteText, setNoteText, onSave, saving, onClose }) {
  return (
    <div style={{
      width: 320, flexShrink: 0, borderLeft: `1px solid ${T.border}`,
      background: T.bg, display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Panel header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Note
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textFaint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>
          ×
        </button>
      </div>

      {/* Task title */}
      <div style={{ padding: '12px 16px 0', fontSize: 14, fontWeight: 600, color: T.text }}>
        {task.title}
      </div>
      {task.start_time && (
        <div style={{ padding: '2px 16px 0', fontSize: 12, color: T.textSub }}>
          {formatTime(task.start_time)}{task.end_time ? ` – ${formatTime(task.end_time)}` : ''}
        </div>
      )}

      {/* Note textarea */}
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Write a note..."
          style={{
            flex: 1, width: '100%', padding: '10px 12px',
            border: `1px solid ${T.borderStrong}`, borderRadius: 6,
            fontSize: 13, lineHeight: 1.5, boxSizing: 'border-box',
            outline: 'none', resize: 'none', fontFamily: 'inherit',
            background: T.elevated, color: T.text,
          }}
        />
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            marginTop: 10, width: '100%', padding: '8px 14px',
            border: 'none', borderRadius: 5, background: T.accent,
            color: T.buttonText, fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}
