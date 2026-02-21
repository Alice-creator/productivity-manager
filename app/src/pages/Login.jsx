import supabase from '../lib/supabase'
import logo from '../assets/productivity-logo.png'
import { T } from '../theme'

export default function Login() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Left — form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px', backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

        {/* Content above overlay */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
            <img src={logo} alt="logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'white' }}>Productivity Manager</span>
          </div>

          {/* Form content */}
          <div style={{ maxWidth: 360, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>Welcome Back!</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 32px' }}>Sign in to access your dashboard and start planning your week.</p>

            <button
              onClick={handleGoogleLogin}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%', padding: '12px 20px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, background: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 500, cursor: 'pointer', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', marginBottom: 16 }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <div style={{ marginTop: 'auto' }} />
        </div>
      </div>

      {/* Right — pitch */}
      <div style={{ width: '45%', background: T.bg, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 56px', color: T.text }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.25, margin: '0 0 24px' }}>Plan your week.<br />Track your time.<br />See your progress.</h2>

        <div style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: 20, marginBottom: 40 }}>
          <p style={{ fontSize: 15, opacity: 0.85, margin: '0 0 12px', lineHeight: 1.6 }}>
            "A focused tool for people who want results — without spending an hour learning the app."
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32 }}>
          {[['Weekly planner', 'Plan across 7 days'], ['Analytics', '5 built-in charts'], ['Notifications', 'Web push alerts']].map(([title, sub]) => (
            <div key={title}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
