import { useState, useEffect } from 'react';
import useStore from '../store/store';
import { useFetch } from '../hooks/useFetch';
import { getTokens, revokeToken, issueToken } from '../services/tokenService';
import { getVaultKeys } from '../services/workspaceService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import TokenTable from '../components/tables/TokenTable';
import TokenCard from '../components/ui/TokenCard';
import IssueTokenForm from '../components/forms/IssueTokenForm';

export default function Tokens() {
  const { tokens, vaultKeys, setTokens, setVaultKeys } = useStore();
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [includeRevoked, setIncludeRevoked] = useState(false);

  const tokensFetch = useFetch((incRevoked) => getTokens(incRevoked));
  const keysFetch = useFetch(getVaultKeys);
  const issueFetch = useFetch(issueToken);
  const revokeFetch = useFetch(revokeToken);

  const loadData = () => {
    tokensFetch.execute(includeRevoked).then(data => setTokens(data.tokens)).catch(console.error);
  };

  useEffect(() => {
    loadData();
    keysFetch.execute().then(data => setVaultKeys(data.keys)).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeRevoked]);

  const handleIssue = async (formData) => {
    await issueFetch.execute(formData);
    setIsIssueModalOpen(false);
    loadData();
  };

  const handleRevoke = async (tokenId) => {
    if (window.confirm('Are you sure you want to revoke this token immediately? This cannot be undone.')) {
      await revokeFetch.execute(tokenId);
      loadData();
    }
  };

  return (
    <div className="animate-[fadeIn_0.4s_ease]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-vault-text-primary to-vault-primary-hover mb-1">
            Proxy Tokens
          </h1>
          <p className="text-sm text-vault-text-secondary">Manage access tokens replacing your real API keys</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-vault-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
              className="accent-vault-primary"
            />
            Show revoked
          </label>
          <div className="flex bg-[#0c1019]/60 p-1 rounded-lg border border-vault-border">
            <button
              className={`p-1.5 rounded transition-all ${viewMode === 'card' ? 'bg-indigo-500/20 text-vault-primary-hover' : 'text-vault-text-muted hover:text-white'}`}
              onClick={() => setViewMode('card')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            </button>
            <button
              className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-indigo-500/20 text-vault-primary-hover' : 'text-vault-text-muted hover:text-white'}`}
              onClick={() => setViewMode('table')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            </button>
          </div>
          {vaultKeys.length > 0 && (
            <Button variant="primary" onClick={() => setIsIssueModalOpen(true)}>
              + Issue Token
            </Button>
          )}
        </div>
      </div>

      {tokensFetch.loading && !tokens.length ? (
        <div className="py-20 text-center text-vault-text-muted">Loading tokens...</div>
      ) : (
        <>
          {viewMode === 'table' ? (
            <div className="glass-card overflow-hidden">
              <TokenTable tokens={tokens} onRevoke={handleRevoke} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 stagger-children">
              {tokens.length === 0 ? (
                <div className="col-span-full py-20 text-center text-vault-text-muted bg-white/5 rounded-xl border border-vault-border border-dashed">
                  <div className="text-4xl mb-3">🎫</div>
                  <h3 className="text-vault-text-primary font-medium mb-1">No proxy tokens found</h3>
                  {vaultKeys.length > 0 ? (
                    <p className="text-sm">Click "Issue Token" to create your first proxy token.</p>
                  ) : (
                    <p className="text-sm">Add an API key in <a href="/my-keys" className="text-vault-primary-hover hover:underline">My Keys</a> first, then come back to issue tokens.</p>
                  )}
                </div>
              ) : (
                tokens.map(token => (
                  <TokenCard key={token._id} token={token} onRevoke={handleRevoke} />
                ))
              )}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Issue Proxy Token"
      >
        <IssueTokenForm
          vaultKeys={vaultKeys}
          onSubmit={handleIssue}
          onCancel={() => setIsIssueModalOpen(false)}
        />
      </Modal>
    </div>
  );
}