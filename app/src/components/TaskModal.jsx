import { useState } from 'react'

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const clamped = Math.min(total, 23 * 60 + 45)
  return `${Math.floor(clamped / 60).toString().padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`
}

export default function TaskModal({ slot, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState(slot.time)
  const [endTime, setEndTime] = useState(addMinutes(slot.time, 30))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    await onSave({
      title: title.trim(),
      date: slot.date,
      start_time: startTime,
      end_time: endTime,
      done: false,
    })
  }

  const timeInputStyle = {
    padding: '7px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 8, padding: 24, width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>New Task — {slot.date}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What are you working on?"
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>Start</label>
              <input
                type="time"
                step="900"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={timeInputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#374151', marginBottom: 4 }}>End</label>
              <input
                type="time"
                step="900"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={timeInputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: 14 }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '7px 16px', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
