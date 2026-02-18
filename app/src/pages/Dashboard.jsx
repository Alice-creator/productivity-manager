import supabase from '../lib/supabase'

export default function Dashboard() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  )
}
