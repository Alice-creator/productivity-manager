import { NavLink } from 'react-router-dom'
import supabase from '../lib/supabase'
import logo from '../assets/productivity-logo.png'

export default function Nav() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', height: 48, fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(45deg, rgba(0,0,0,1) 0%, rgba(126,136,140,1) 50%, rgba(211,234,242,1) 100%)' }}>
      <img src={logo} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 12 }} />
      <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
      <NavLink to="/week" style={({ isActive }) => linkStyle(isActive)}>Week</NavLink>
      <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: 'auto', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'white' }}>
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
    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.65)',
    background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
  }
}
