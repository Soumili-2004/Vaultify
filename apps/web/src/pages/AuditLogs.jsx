import { useState, useEffect } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getAuditLogs } from '../services/auditService';
import AuditTable from '../components/tables/AuditTable';
import Button from '../components/ui/Button';

export default function AuditLogs() {
  const { auditLogs, setAuditLogs } = useStore();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [environment, setEnvironment] = useState('');

  const logsFetch = useFetch((p, env) => getAuditLogs(p, 20, env ? { environment: env } : {}));

  const loadLogs = () => {
    logsFetch.execute(page, environment)
      .then(data => {
        setAuditLogs(data.logs);
        setTotalPages(data.totalPages);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, environment]);

  return (
    <div className="animate-[fadeIn_0.4s_ease] flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-vault-text-primary to-vault-primary-hover mb-1">
            Audit Logs
          </h1>
          <p className="text-sm text-vault-text-secondary">Real-time view of all proxy token usage</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="vault-input py-1.5 w-auto"
            value={environment}
            onChange={(e) => { setEnvironment(e.target.value); setPage(1); }}
          >
            <option value="">All Environments</option>
            <option value="production">Production</option>
            <option value="preview">Preview</option>
            <option value="development">Development</option>
          </select>
          <Button variant="secondary" onClick={loadLogs} loading={logsFetch.loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          {logsFetch.loading && !auditLogs.length ? (
            <div className="py-20 text-center text-vault-text-muted">Loading logs...</div>
          ) : (
            <AuditTable logs={auditLogs} />
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-vault-border p-4 flex items-center justify-between bg-[#0c1019]/40 shrink-0">
            <span className="text-sm text-vault-text-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
