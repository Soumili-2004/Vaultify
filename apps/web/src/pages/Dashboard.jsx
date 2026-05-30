import { useEffect } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getAuditStats, getAuditLogs } from '../services/auditService';
import { getTokens } from '../services/tokenService';
import StatsCard from '../components/ui/StatsCard';
import AuditTable from '../components/tables/AuditTable';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { auditStats, tokens, setAuditStats, setTokens } = useStore();

  const statsFetch = useFetch(getAuditStats);
  const tokensFetch = useFetch(() => getTokens(false));
  const logsFetch = useFetch(() => getAuditLogs(1, 5));

  useEffect(() => {
    statsFetch.execute().then(setAuditStats).catch(console.error);
    tokensFetch.execute().then(data => setTokens(data.tokens)).catch(console.error);
    logsFetch.execute().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recentLogs = logsFetch.data?.logs || [];
  const activeTokens = tokens?.length || 0;

  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-vault-text-primary to-vault-primary-hover mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-vault-text-secondary">Overview of your proxy infrastructure</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Tokens"
          value={activeTokens}
          icon="🎫"
          trend={{ isPositive: true, value: 12 }}
        />
        <StatsCard
          title="Total API Calls"
          value={auditStats?.totalCalls || 0}
          icon="🔄"
        />
        <StatsCard
          title="Calls Today"
          value={auditStats?.callsToday || 0}
          icon="📅"
          trend={{ isPositive: true, value: 5 }}
        />
        <StatsCard
          title="Blocked Requests"
          value={auditStats?.blockedToday || 0}
          icon="🛡️"
          trend={auditStats?.blockedToday > 0 ? { isPositive: false, value: 'Action Needed' } : null}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-vault-text-primary">Recent Activity</h3>
              <Link to="/audit">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>

            {logsFetch.loading && !recentLogs.length ? (
              <div className="py-10 text-center text-vault-text-muted">Loading activity...</div>
            ) : (
              <AuditTable logs={recentLogs} />
            )}
          </div>
        </div>

        <div>
          <div className="glass-card frost-card p-6 relative overflow-hidden group h-full">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-vault-primary/10 rounded-full blur-3xl"></div>
            <h3 className="headline-text text-lg font-semibold text-vault-text-primary mb-4">Quick Actions</h3>

            <div className="space-y-3">
              <Link to="/tokens" className="block">
                <div className="p-4 rounded-lg bg-[#0c1019]/60 border border-vault-border hover:border-vault-primary/30 transition-colors flex items-center gap-3">
                  <span className="text-xl">🎫</span>
                  <div>
                    <h4 className="headline-text text-sm font-medium text-vault-text-primary">Issue Token</h4>
                    <p className="body-text text-xs text-vault-text-muted mt-0.5">Create a new proxy token</p>
                  </div>
                </div>
              </Link>
              <Link to="/workspace" className="block">
                <div className="p-4 rounded-lg bg-[#0c1019]/60 border border-vault-border hover:border-vault-primary/30 transition-colors flex items-center gap-3">
                  <span className="text-xl">👥</span>
                  <div>
                    <h4 className="headline-text text-sm font-medium text-vault-text-primary">Invite Member</h4>
                    <p className="body-text text-xs text-vault-text-muted mt-0.5">Add someone to your workspace</p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-vault-border">
              <h4 className="tag-label text-xs font-semibold text-vault-text-secondary uppercase tracking-wider mb-3">System Health</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-vault-text-muted">Average Latency</span>
                <span className="font-mono text-vault-text-primary">{Math.round(auditStats?.avgLatency || 0)}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-vault-text-muted">Proxy Engine</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
