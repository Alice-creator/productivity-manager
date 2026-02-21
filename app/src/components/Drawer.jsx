import { useState, useEffect } from 'react'
import supabase from '../lib/supabase'
import { T } from '../theme'

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6']
const PANEL_WIDTH = 280
const BAR_WIDTH = 44

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const clamped = Math.min(total, 23 * 60 + 45)
  return `${Math.floor(clamped / 60).toString().padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`
}

function stripSeconds(t) {
  if (!t) return t
  return t.split(':').slice(0, 2).join(':')
}

export default function Drawer({ slot, editTask, categories, onCategoriesChange, onTaskChanged }) {
  const [activeTab, setActiveTab] = useState(null)

  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(PRESET_COLORS[0])

  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [selectedCats, setSelectedCats] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (slot) {
      setActiveTab('task')
      setEditingId(null)
      setDone(false)
      setDate(slot.date)
      setStartTime(slot.time)
      setEndTime(addMinutes(slot.time, 30))
      setTitle('')
      setSelectedCats([])
    }
  }, [slot])

  useEffect(() => {
    if (editTask) {
      setActiveTab('task')
      setEditingId(editTask.id)
      setTitle(editTask.title)
      setDate(editTask.date)
      setStartTime(stripSeconds(editTask.start_time) || '09:00')
      setEndTime(stripSeconds(editTask.end_time) || '09:30')
      setSelectedCats(editTask.category_ids || [])
      setDone(editTask.done || false)
    }
  }, [editTask])

  function handleIconClick(tab) {
    if (activeTab === tab) {
      setActiveTab(null)
    } else {
      setActiveTab(tab)
      if (tab === 'task') {
        setEditingId(null)
        setTitle('')
        setDate(new Date().toISOString().split('T')[0])
        setStartTime('09:00')
        setEndTime('09:30')
        setSelectedCats([])
      }
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!catName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('categories').insert({ name: catName.trim(), color: catColor, user_id: user.id }).select().single()
    if (data) {
      onCategoriesChange([...categories, data])
      setCatName('')
      setCatColor(PRESET_COLORS[0])
    }
  }

  async function handleDeleteCategory(id) {
    await supabase.from('categories').delete().eq('id', id)
    onCategoriesChange(categories.filter(c => c.id !== id))
  }

  function toggleCat(id) {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSaveTask(e) {
    e.preventDefault()
    if (!title.trim()) return

    if (editingId) {
      const { data: task } = await supabase
        .from('tasks')
        .update({ title: title.trim(), date, start_time: startTime, end_time: endTime })
        .eq('id', editingId)
        .select()
        .single()

      if (task) {
        await supabase.from('task_categories').delete().eq('task_id', editingId)
        if (selectedCats.length > 0) {
          await supabase.from('task_categories').insert(selectedCats.map(cid => ({ task_id: editingId, category_id: cid })))
        }
        onTaskChanged()
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: task } = await supabase
        .from('tasks')
        .insert({ title: title.trim(), date, start_time: startTime, end_time: endTime, done: false, user_id: user.id })
        .select()
        .single()

      if (task && selectedCats.length > 0) {
        await supabase.from('task_categories').insert(selectedCats.map(cid => ({ task_id: task.id, category_id: cid })))
      }

      if (task) {
        onTaskChanged()
        setTitle('')
        setSelectedCats([])
      }
    }
  }

  async function handleDeleteTask() {
    if (!editingId) return
    await supabase.from('tasks').delete().eq('id', editingId)
    onTaskChanged()
    setEditingId(null)
    setTitle('')
    setSelectedCats([])
  }

  async function handleToggleDone() {
    if (!editingId) return
    const newDone = !done
    await supabase.from('tasks').update({ done: newDone }).eq('id', editingId)
    setDone(newDone)
    onTaskChanged()
  }

  const expanded = activeTab !== null
  const isEditing = activeTab === 'task' && editingId !== null

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100%' }}>
      {/* Icon bar */}
      <div style={{ width: BAR_WIDTH, background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4, flexShrink: 0, borderRight: `1px solid ${T.border}` }}>
        <IconBtn active={activeTab === 'categories'} onClick={() => handleIconClick('categories')} title="Categories">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
          </svg>
        </IconBtn>
        <IconBtn active={activeTab === 'task'} onClick={() => handleIconClick('task')} title="New Task">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </IconBtn>
      </div>

      {/* Panel */}
      <div style={{ width: expanded ? PANEL_WIDTH : 0, minWidth: expanded ? PANEL_WIDTH : 0, transition: 'width 0.2s ease, min-width 0.2s ease', overflow: 'hidden', borderRight: expanded ? `1px solid ${T.border}` : 'none', background: T.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {activeTab === 'categories' ? 'Categories' : isEditing ? 'Edit Task' : 'New Task'}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          {activeTab === 'categories' && (
            <CategoriesTab
              categories={categories}
              catName={catName}
              setCatName={setCatName}
              catColor={catColor}
              setCatColor={setCatColor}
              onAdd={handleAddCategory}
              onDelete={handleDeleteCategory}
            />
          )}
          {activeTab === 'task' && (
            <TaskTab
              isEditing={isEditing}
              isDone={done}
              title={title}
              setTitle={setTitle}
              date={date}
              setDate={setDate}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              categories={categories}
              selectedCats={selectedCats}
              toggleCat={toggleCat}
              onSave={handleSaveTask}
              onDelete={handleDeleteTask}
              onToggleDone={handleToggleDone}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function IconBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, cursor: 'pointer', background: active ? T.elevated : 'transparent', color: active ? T.text : T.textFaint }}
    >
      {children}
    </button>
  )
}

function CategoriesTab({ categories, catName, setCatName, catColor, setCatColor, onAdd, onDelete }) {
  return (
    <div>
      {categories.length === 0 && (
        <p style={{ fontSize: 12, color: T.textDim, textAlign: 'center', margin: '12px 0' }}>No categories yet</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: T.elevated, borderRadius: 5, border: `1px solid ${T.borderStrong}` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: T.text }}>{cat.name}</span>
            <button onClick={() => onDelete(cat.id)} style={{ background: 'none', border: 'none', fontSize: 16, color: T.textFaint, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Delete">×</button>
          </div>
        ))}
      </div>

      <form onSubmit={onAdd}>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Add new</div>
        <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Category name" style={{ ...inputStyle, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setCatColor(c)} style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: catColor === c ? `2px solid ${T.text}` : '2px solid transparent', boxShadow: catColor === c ? `0 0 0 1px ${T.borderStrong}` : 'none' }} />
          ))}
        </div>
        <button type="submit" style={primaryBtnStyle}>Add</button>
      </form>
    </div>
  )
}

function TaskTab({ isEditing, isDone, title, setTitle, date, setDate, startTime, setStartTime, endTime, setEndTime, categories, selectedCats, toggleCat, onSave, onDelete, onToggleDone }) {
  return (
    <form onSubmit={onSave}>
      {isEditing && (
        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={onToggleDone} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${isDone ? '#064e3b' : T.borderStrong}`, borderRadius: 5, background: isDone ? '#052e16' : T.elevated, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: isDone ? '#6ee7b7' : T.textSub }}>
            {isDone ? 'Done — mark undone' : 'Mark as done'}
          </button>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <Label>Title</Label>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you working on?" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Label>Date</Label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <Label>Start</Label>
          <input type="time" step="900" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>End</Label>
          <input type="time" step="900" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {categories.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Label>Categories</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {categories.map(cat => (
              <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: T.text }}>
                <input type="checkbox" checked={selectedCats.includes(cat.id)} onChange={() => toggleCat(cat.id)} style={{ accentColor: cat.color }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                {cat.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <button type="submit" style={primaryBtnStyle}>{isEditing ? 'Update Task' : 'Save Task'}</button>

      {isEditing && (
        <button type="button" onClick={onDelete} style={{ ...primaryBtnStyle, background: 'transparent', border: `1px solid ${T.dangerBorder}`, color: T.danger, marginTop: 8 }}>
          Delete Task
        </button>
      )}
    </form>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: T.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>
}

const inputStyle = {
  width: '100%', padding: '7px 9px',
  border: `1px solid ${T.borderStrong}`,
  borderRadius: 5, fontSize: 13, boxSizing: 'border-box', outline: 'none',
  background: T.elevated, color: T.text,
}

const primaryBtnStyle = {
  width: '100%', padding: '8px 14px', border: 'none', borderRadius: 5,
  background: T.text, color: T.bg, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
