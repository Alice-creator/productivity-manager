import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import supabase from '../lib/supabase'
import logo from '../assets/productivity-logo.png'

export default function Nav({ user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const avatarUrl = user?.user_metadata?.avatar_url
  const name = user?.user_metadata?.full_name || user?.email || ''
  const email = user?.email || ''

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', height: 48, fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(45deg, rgba(0,0,0,1) 0%, rgba(126,136,140,1) 50%, rgba(211,234,242,1) 100%)' }}>
      <img src={logo} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 12 }} />
      <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
      <NavLink to="/week" style={({ isActive }) => linkStyle(isActive)}>Week</NavLink>

      {/* Account avatar */}
      <div ref={menuRef} style={{ marginLeft: 'auto', position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '50%', padding: 0, cursor: 'pointer', width: 36, height: 36, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 700 }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: 40, right: 0, width: 220,
            background: 'white', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            overflow: 'hidden', zIndex: 300, fontFamily: 'system-ui, sans-serif',
          }}>
            {/* User info */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '4px 0' }}>
              <MenuItem onClick={() => { setMenuOpen(false) }}>
                <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}>Dashboard</NavLink>
              </MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false) }}>
                <NavLink to="/week" style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}>Week Planner</NavLink>
              </MenuItem>
            </div>

            {/* Log out */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '4px 0' }}>
              <MenuItem onClick={() => supabase.auth.signOut()} danger>
                Log out
              </MenuItem>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

function MenuItem({ onClick, danger, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 16px', fontSize: 13, cursor: 'pointer',
        color: danger ? '#ef4444' : '#374151',
        fontWeight: danger ? 600 : 400,
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
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
