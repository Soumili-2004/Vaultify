import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(formData.name, formData.email, formData.password);
      } else {
        await login(formData.email, formData.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[20%] left-[20%] w-100 h-100 bg-vault-primary/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[20%] right-[20%] w-75 h-75 bg-emerald-500/10 rounded-full blur-[80px]"></div>

      <div className="w-full max-w-md p-8 relative z-10 animate-[slideUp_0.5s_ease] rounded-2xl border border-[rgba(99,102,241,0.12)] bg-[rgba(16,22,40,0.55)] backdrop-blur-xl shadow-[0_0_30px_rgba(99,102,241,0.08)]">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4 w-16 h-16 mx-auto flex items-center justify-center bg-linear-to-br from-vault-primary to-indigo-400 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            🔐
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-vault-text-secondary">
            {isRegister ? 'Create an Account' : 'Welcome back to Vaultify'}
          </h1>
          <p className="text-sm text-vault-text-muted mt-2">
            Secure proxy tokens for your API keys
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="animate-[fadeIn_0.3s_ease]">
              <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
              placeholder="you@company.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-vault-text-secondary mb-1.5 uppercase tracking-wide">Password</label>
            <input
              type="password"
              className="w-full bg-vault-bg-input border border-vault-border rounded-lg px-3.5 py-2.5 text-sm text-vault-text-primary transition-colors focus:outline-none focus:border-vault-primary focus:ring-3 focus:ring-indigo-500/25 placeholder:text-vault-text-muted"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full mt-6 py-2.5 text-[0.95rem]" loading={loading}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-vault-text-muted">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            className="text-vault-primary hover:text-vault-primary-hover font-medium hover:underline transition-all"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
