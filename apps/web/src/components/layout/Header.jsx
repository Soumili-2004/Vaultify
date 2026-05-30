import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/tokens': 'Proxy Tokens',
  '/audit': 'Audit Logs',
};

export default function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Vaultify';

  return (
    <header className="fixed top-0 left-65 right-0 h-16 bg-[#06080fcc] backdrop-blur-md border-b border-vault-border flex items-center justify-between px-8 z-40">
      <div className="flex items-center">
        <h2 className="text-base font-semibold text-vault-text-secondary">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[0.78rem] text-vault-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse"></span>
          <span>Server Online</span>
        </div>
      </div>
    </header>
  );
}
