import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, Key, CheckCircle2, ArrowRight } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface RevokeConsentModalProps {
  isOpen: boolean;
  initialTab?: 'recover' | 'revoke';
  onClose: () => void;
  speakerId: string;
  onRevokeSuccess: () => void;
  onRecoverSuccess: (recoveredSpeakerId: string, consentVersion: string) => void;
}

export const RevokeConsentModal: React.FC<RevokeConsentModalProps> = ({
  isOpen,
  initialTab = 'recover',
  onClose,
  speakerId,
  onRevokeSuccess,
  onRecoverSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'recover' | 'revoke'>(initialTab);

  // État onglet "Reprendre ma session" (/api/consent/claim)
  const [claimCode, setClaimCode] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // État onglet "Droit à l'oubli / Révocation" (/api/consent/revoke)
  const [isDeleting, setIsDeleting] = useState(false);
  const [revokeFeedback, setRevokeFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  if (!isOpen) return null;

  const handleClaimSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = claimCode.trim().toUpperCase();
    if (!cleaned || isClaiming) return;

    try {
      setIsClaiming(true);
      setClaimFeedback(null);

      const res = await fetch(apiUrl('/api/consent/claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode: cleaned })
      });

      const data = await res.json();
      if (!res.ok) {
        const extra =
          typeof data.attemptsLeft === 'number' && data.attemptsLeft > 0
            ? ` (${data.attemptsLeft} essai(s) restant(s))`
            : '';
        throw new Error(`${data.error || 'Code introuvable.'}${extra}`);
      }

      setClaimFeedback({
        type: 'success',
        text: `Session rétablie (${data.speakerId.slice(0, 10)}...) ! Chargement de votre progression...`
      });

      window.setTimeout(() => {
        setClaimCode('');
        onRecoverSuccess(data.speakerId, data.consent?.consentVersion || 'v1.0-2026-10');
        onClose();
      }, 900);
    } catch (err: any) {
      setClaimFeedback({ type: 'error', text: err.message || 'Erreur lors de la récupération.' });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRevoke = async () => {
    try {
      setIsDeleting(true);
      setRevokeFeedback(null);

      const payload =
        useRecoveryCode && recoveryCodeInput.trim()
          ? { recoveryCode: recoveryCodeInput.trim().toUpperCase() }
          : { speakerId };

      const res = await fetch(apiUrl('/api/consent/revoke'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la révocation.');
      }

      setRevokeFeedback({
        type: 'success',
        text: data.message || 'Données supprimées définitivement.'
      });
      window.setTimeout(() => {
        setRecoveryCodeInput('');
        onRevokeSuccess();
        onClose();
      }, 1300);
    } catch (err: any) {
      setRevokeFeedback({ type: 'error', text: err.message || 'Erreur lors de la suppression.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
      <div className="modal-surface" style={{ maxWidth: '540px' }}>
        <div className="modal-head">
          <div className="modal-head-title">
            <div className={`modal-head-badge ${activeTab === 'revoke' ? 'danger' : ''}`}>
              {activeTab === 'recover' ? <Key size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <h2 id="session-modal-title">
                {activeTab === 'recover' ? 'Ma session participant' : "Révocation et droit à l'oubli"}
              </h2>
              <span className="modal-head-sub">Identifiant actif : {speakerId.slice(0, 12)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon-subtle" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* Onglets Reprendre / Supprimer */}
        <div className="modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            id="tab-recover-session"
            aria-selected={activeTab === 'recover'}
            className={`modal-tab-btn ${activeTab === 'recover' ? 'active' : ''}`}
            onClick={() => setActiveTab('recover')}
          >
            <Key size={14} />
            <span>Reprendre ma session</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-revoke-consent"
            aria-selected={activeTab === 'revoke'}
            className={`modal-tab-btn danger ${activeTab === 'revoke' ? 'active' : ''}`}
            onClick={() => setActiveTab('revoke')}
          >
            <Trash2 size={14} />
            <span>Supprimer mes données</span>
          </button>
        </div>

        {activeTab === 'recover' ? (
          <form onSubmit={handleClaimSession}>
            <div className="modal-scroll-body">
              <p className="consent-clause-text">
                Vous avez déjà participé sur un autre appareil ou effacé votre navigateur ?
                Saisissez votre code secret pour restaurer votre profil et retrouver vos phrases déjà enregistrées.
              </p>

              <div className="session-code-box">
                <label htmlFor="claim-recovery-code-input" className="field-label">
                  Votre code de récupération (format MINA-XXXX-XXXX)
                </label>
                <div className="input-with-icon">
                  <Key size={16} className="input-icon-left" />
                  <input
                    id="claim-recovery-code-input"
                    type="text"
                    placeholder="MINA-7K9Q-X24V"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    className="code-text-input"
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              {claimFeedback && (
                <div className={claimFeedback.type === 'error' ? 'error-banner' : 'success-banner'} role="alert">
                  {claimFeedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{claimFeedback.text}</span>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button type="button" className="vdt-btn-secondary vdt-btn-sm" onClick={onClose}>
                Annuler
              </button>
              <button
                type="submit"
                id="confirm-claim-btn"
                className="vdt-btn-primary vdt-btn-sm"
                disabled={isClaiming || !claimCode.trim()}
              >
                {isClaiming ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Vérification...</span>
                  </>
                ) : (
                  <>
                    <span>Rétablir ma session</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal-scroll-body">
              <p className="consent-clause-text">
                Vous pouvez à tout moment exercer votre droit de retrait. Cette action est{' '}
                <strong style={{ color: 'var(--record-red)' }}>définitive et irréversible</strong> :
              </p>

              <ul className="revoke-bullets">
                <li>Tous vos fichiers audio seront immédiatement supprimés du stockage.</li>
                <li>Toutes les métadonnées de vos prises seront purgées de la base de données.</li>
                <li>Votre consentement et votre code secret seront détruits.</li>
              </ul>

              {!useRecoveryCode ? (
                <div className="session-code-box">
                  <span className="field-hint">Session active détectée :</span>
                  <code className="session-id-mono">{speakerId}</code>
                  <button
                    type="button"
                    className="inline-text-link"
                    onClick={() => setUseRecoveryCode(true)}
                  >
                    Utiliser un code secret de récupération à la place
                  </button>
                </div>
              ) : (
                <div className="session-code-box">
                  <label htmlFor="recovery-code-input" className="field-label">
                    Code secret de récupération (ex : MINA-XXXX-XXXX) :
                  </label>
                  <div className="input-with-icon">
                    <Key size={16} className="input-icon-left" />
                    <input
                      id="recovery-code-input"
                      type="text"
                      placeholder="MINA-XXXX-XXXX"
                      value={recoveryCodeInput}
                      onChange={(e) => setRecoveryCodeInput(e.target.value)}
                      className="code-text-input"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-text-link"
                    onClick={() => setUseRecoveryCode(false)}
                  >
                    Revenir à la session active
                  </button>
                </div>
              )}

              {revokeFeedback && (
                <div className={revokeFeedback.type === 'error' ? 'error-banner' : 'success-banner'} role="alert">
                  {revokeFeedback.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{revokeFeedback.text}</span>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="vdt-btn-secondary vdt-btn-sm"
                onClick={onClose}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                type="button"
                id="confirm-revoke-btn"
                className="vdt-btn-danger vdt-btn-sm"
                onClick={handleRevoke}
                disabled={isDeleting || (useRecoveryCode && !recoveryCodeInput.trim())}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Supprimer définitivement</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
