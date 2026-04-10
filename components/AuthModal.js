import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AuthModal({ onClose }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, configured } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleEmail(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const fn = mode === 'signin' ? signInWithEmail : signUpWithEmail
    const { error: err } = await fn(email, password)
    setLoading(false)
    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      setSuccess('Check your email to confirm your account.')
    } else {
      onClose()
    }
  }

  if (!configured) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <h2 className="font-semibold text-gray-900 mb-2">Login not configured</h2>
          <p className="text-sm text-gray-500">Add Supabase environment variables to enable login. See the setup guide.</p>
          <button onClick={onClose} className="mt-4 w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-lg">✕</button>
        </div>

        {success ? (
          <div className="text-sm text-green-700 bg-green-50 rounded-xl p-4 text-center">{success}</div>
        ) : (
          <>
            {/* Google */}
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.48A4.8 4.8 0 0 1 4.5 7.52V5.45H1.83a8 8 0 0 0 0 7.1z"/><path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 0 0 1.83 5.45L4.5 7.52A4.8 4.8 0 0 1 8.98 3.58z"/></svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email form */}
            <form onSubmit={handleEmail} className="flex flex-col gap-3">
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" required minLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: '#2d7a2d' }}
              >
                {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-4">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }} className="text-green-700 font-medium">
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
