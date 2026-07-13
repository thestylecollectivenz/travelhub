import * as React from 'react';
import { useAppConfig } from '../../context/AppConfigContext';
import { useCanManageSiteConfig } from '../../hooks/useCanManageSiteConfig';
import {
  BOOKING_AFFILIATES_CONFIG_KEY,
  DEFAULT_BOOKING_AFFILIATE_PARTNERS,
  parseBookingAffiliateOverrides,
  serializeBookingAffiliateOverrides,
  type BookingAffiliateOverridesMap
} from '../../utils/bookingAffiliateLinks';

export interface BookingAffiliateSettingsPanelProps {
  onClose: () => void;
}

export const BookingAffiliateSettingsPanel: React.FC<BookingAffiliateSettingsPanelProps> = ({ onClose }) => {
  const { appConfig, saveAppConfigValue } = useAppConfig();
  const canManage = useCanManageSiteConfig();
  const savedJson = appConfig.get(BOOKING_AFFILIATES_CONFIG_KEY);
  const [draft, setDraft] = React.useState<BookingAffiliateOverridesMap>(() =>
    parseBookingAffiliateOverrides(savedJson)
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setDraft(parseBookingAffiliateOverrides(savedJson));
  }, [savedJson]);

  const patchPartner = (id: string, patch: BookingAffiliateOverridesMap[string]): void => {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      await saveAppConfigValue(BOOKING_AFFILIATES_CONFIG_KEY, serializeBookingAffiliateOverrides(draft));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save affiliate settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.28)',
          zIndex: 10060,
          display: 'flex',
          justifyContent: 'flex-end'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <aside
          style={{
            width: 'min(100%, 28rem)',
            height: '100%',
            background: 'var(--color-surface-raised)',
            padding: 'var(--space-5)'
          }}
        >
          <p>Only site owners and editors with list-manage permission can configure affiliate partners.</p>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </aside>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.28)',
        zIndex: 10060,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <aside
        style={{
          width: 'min(100%, 32rem)',
          height: '100%',
          background: 'var(--color-surface-raised)',
          borderLeft: 'var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        aria-label="Booking affiliate settings"
      >
        <div style={{ padding: 'var(--space-5)', borderBottom: 'var(--border-default)' }}>
          <h2 style={{ margin: 0, color: 'var(--color-blue-800)' }}>Booking affiliates</h2>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>
            Site-wide partner links and affiliate IDs stored in the AppConfig list.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
          {DEFAULT_BOOKING_AFFILIATE_PARTNERS.map((p) => {
            const row = draft[p.id] || {};
            return (
              <div
                key={p.id}
                style={{
                  border: 'var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 'var(--space-2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <strong style={{ color: 'var(--color-blue-800)' }}>{p.label}</strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <input
                      type="checkbox"
                      checked={row.enabled !== false}
                      onChange={(e) => patchPartner(p.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: 'var(--font-size-xs)' }}>
                  Affiliate / partner ID
                  <input
                    type="text"
                    value={row.affiliateId || ''}
                    onChange={(e) => patchPartner(p.id, { affiliateId: e.target.value })}
                    placeholder={p.affiliateQueryParam ? `Appended as ${p.affiliateQueryParam}=…` : 'Optional'}
                    style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.5rem' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem', fontSize: 'var(--font-size-xs)' }}>
                  URL override (optional)
                  <input
                    type="text"
                    value={row.hrefOverride || ''}
                    onChange={(e) => patchPartner(p.id, { hrefOverride: e.target.value })}
                    placeholder={p.hrefTemplate}
                    style={{ border: 'var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.5rem' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                  <input
                    type="checkbox"
                    checked={row.recommended ?? p.recommended}
                    onChange={(e) => patchPartner(p.id, { recommended: e.target.checked })}
                  />
                  Show in Recommended section
                </label>
              </div>
            );
          })}
          {error ? <p style={{ margin: 0, color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)' }}>{error}</p> : null}
        </div>
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderTop: 'var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)'
          }}
        >
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save affiliates'}
          </button>
        </div>
      </aside>
    </div>
  );
};
