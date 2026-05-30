import { getProviderInfo, maskToken, formatDate, getTokenStatus } from '../../utils/helpers';
import Badge from './Badge';
import Button from './Button';

export default function TokenCard({ token, onRevoke }) {
  const provider = getProviderInfo(token.vaultKeyId?.provider);
  const status = getTokenStatus(token);
  const isRevoked = !!token.revokedAt;
  const isExpired = token.expiresAt && new Date(token.expiresAt) < new Date();

  const statusVariant = isRevoked ? 'danger' : isExpired ? 'warning' : 'success';

  return (
    <div className="glass-card frost-card p-5 flex flex-col h-full relative overflow-hidden group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
      {/* Provider Accent Line */}
      <div
        className="absolute top-0 left-0 w-full h-1 opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: provider.color }}
      ></div>

      <div className="flex justify-between items-start mb-4 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-lg border border-vault-border">
            {provider.icon}
          </div>
          <div>
            <h4 className="headline-text text-sm font-semibold text-vault-text-primary">
              {token.vaultKeyId?.name || 'Unknown Key'}
            </h4>
            <div className="body-text text-[0.7rem] text-vault-text-muted mt-0.5">
              {provider.name} • {token.environment}
            </div>
          </div>
        </div>
        <Badge variant={statusVariant}>{status.label}</Badge>
      </div>

      <div className="bg-[#0c1019]/60 border border-vault-border rounded px-3 py-2.5 flex items-center justify-between mb-4 mt-auto">
        <code className="font-mono text-xs text-indigo-200">
          {maskToken(token.tokenString)}
        </code>
        <button
          className="text-vault-text-muted hover:text-white transition-colors"
          onClick={() => navigator.clipboard.writeText(token.tokenString)}
          title="Copy full token"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[0.75rem] mb-5">
        <div>
          <span className="tag-label text-vault-text-muted block mb-0.5">Endpoints</span>
          <span className="body-text text-vault-text-primary">
            {token.allowedEndpoints?.length > 0 ? (
              token.allowedEndpoints.length === 1 && token.allowedEndpoints[0] === '*' ? 'All endpoints' : `${token.allowedEndpoints.length} restricted`
            ) : 'None'}
          </span>
        </div>
        <div>
          <span className="tag-label text-vault-text-muted block mb-0.5">Created</span>
          <span className="body-text text-vault-text-primary">{formatDate(token.createdAt)}</span>
        </div>
      </div>

      {!isRevoked && (
        <Button
          variant="danger"
          size="sm"
          className="w-full mt-auto"
          onClick={() => onRevoke(token._id)}
        >
          Revoke Access
        </Button>
      )}
    </div>
  );
}
