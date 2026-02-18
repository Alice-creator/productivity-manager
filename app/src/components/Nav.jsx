import { NavLink } from 'react-router-dom'
import supabase from '../lib/supabase'

export default function Nav() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', borderBottom: '1px solid #e5e7eb', height: 48, fontFamily: 'system-ui, sans-serif' }}>
      <span style={{ fontWeight: 700, fontSize: 15, marginRight: 16 }}>Productivity</span>
      <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
      <NavLink to="/week" style={({ isActive }) => linkStyle(isActive)}>Week</NavLink>
      <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 'auto', padding: '4px 12px', border: '1px solid #e5e7eb', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: 13 }}>
        Sign out
      </button>
    </nav>
  )
}

function linkStyle(isActive) {
  return {
    padding: '4px 10px',
    borderRadius: 4,
    textDecoration: 'none',
    fontSize: 14,
    color: isActive ? '#2563eb' : '#374151',
    background: isActive ? '#eff6ff' : 'transparent',
    fontWeight: isActive ? 500 : 400,
  }
}
