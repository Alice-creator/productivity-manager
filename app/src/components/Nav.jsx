import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import supabase from '../lib/supabase'
import logo from '../assets/productivity-logo.png'
import { T } from '../theme'

export default function Nav({ user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const avatarUrl = user?.user_metadata?.avatar_url
  const name = user?.user_metadata?.full_name || user?.email || ''
  const email = user?.email || ''

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', height: 48, fontFamily: 'system-ui, sans-serif', background: T.bg, borderBottom: `1px solid ${T.border}` }}>
      <img src={logo} alt="logo" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', marginRight: 12, opacity: 0.9 }} />
      <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
      <NavLink to="/schedule" style={({ isActive }) => linkStyle(isActive)}>Schedule</NavLink>

      <div ref={menuRef} style={{ marginLeft: 'auto', position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: 'none', borderRadius: '50%', padding: 0, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: `0 0 0 2px ${T.borderStrong}` }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text, fontSize: 14, fontWeight: 700, boxShadow: `0 0 0 2px ${T.borderStrong}` }}>
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: 44, right: 0, width: 220,
            background: T.surface, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            overflow: 'hidden', zIndex: 300, fontFamily: 'system-ui, sans-serif',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 12, color: T.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            </div>

            <div style={{ padding: '4px 0' }}>
              <MenuItem onClick={() => setMenuOpen(false)}>
                <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}>Dashboard</NavLink>
              </MenuItem>
              <MenuItem onClick={() => setMenuOpen(false)}>
                <NavLink to="/schedule" style={{ textDecoration: 'none', color: 'inherit', display: 'block', width: '100%' }}>Schedule</NavLink>
              </MenuItem>
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, padding: '4px 0' }}>
              <MenuItem onClick={() => supabase.auth.signOut()} danger>Log out</MenuItem>
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
      style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer', color: danger ? T.danger : T.text, fontWeight: danger ? 600 : 400 }}
      onMouseEnter={e => e.currentTarget.style.background = T.elevated}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </div>
  )
}

function linkStyle(isActive) {
  return {
    padding: '5px 12px',
    borderRadius: 4,
    textDecoration: 'none',
    fontSize: 15,
    color: isActive ? T.text : T.textSub,
    background: isActive ? T.elevated : 'transparent',
    fontWeight: isActive ? 600 : 400,
  }
}
