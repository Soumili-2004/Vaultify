import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/tokens', label: 'Proxy Tokens', icon: '🎫' },
  { path: '/my-keys', label: 'My Keys', icon: '🔐' },
  { path: '/audit', label: 'Audit Logs', icon: '📋' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed top-0 left-0 w-65 h-screen bg-vault-glass-bg backdrop-blur-xl border-r border-vault-glass-border flex flex-col z-50 animate-[slideInLeft_0.4s_ease]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-vault-border">
        <div className="text-2xl w-9 h-9 flex items-center justify-center bg-linear-to-br from-vault-primary to-indigo-400 rounded-lg shadow-[0_0_20px_rgba(99,102,241,0.25)]">
          🔐
        </div>
        <span className="text-[1.2rem] font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-br from-vault-text-primary to-vault-primary-hover">
          Vaultify
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => {
              const base =
                'relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ';
              const active =
                'bg-indigo-500/10 text-vault-primary-hover font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-[60%] before:bg-vault-primary before:rounded-full';
              const inactive = 'text-vault-text-secondary hover:bg-indigo-500/5 hover:text-vault-text-primary';
              return base + (isActive ? active : inactive);
            }}
          >
            <span className="text-[1.1rem]">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-vault-border flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-vault-primary to-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold text-vault-text-primary truncate">{user?.name || 'User'}</span>
            <span className="text-[0.7rem] text-vault-text-muted truncate">{user?.email || ''}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout} 
          title="Logout"
          className="bg-transparent border border-vault-border rounded text-vault-text-muted text-sm cursor-pointer px-2 py-1.5 transition-all hover:border-red-500 hover:text-red-500 hover:bg-red-500/10"
        >
          ↗
        </button>
      </div>
    </aside>
  );
}
