import React, { useState } from 'react';
import { Shield, Key, Copy, Check, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface ConsentModalProps {
  isOpen: boolean;
  onClose?: () => void;
  speakerId: string;
  onAccept: (version: string) => void;
  onSwitchToRecover?: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onClose,
  speakerId,
  onAccept,
  onSwitchToRecover
}) => {
  const [hasAgreed, setHasAgreed] = useState(false);
  const [step, setStep] = useState<'agreement' | 'recovery_code'>('agreement');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const consentVersion = 'v1.0-2026-10';

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!hasAgreed || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setApiError(null);

      const res = await fetch(apiUrl('/api/consent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId, consentVersion })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement du consentement.");
      }

      if (data.recoveryCode && data.recoveryCode !== '(identifiant existant)') {
        setRecoveryCode(data.recoveryCode);
        setStep('recovery_code');
      } else {
        setStep('agreement');
        onAccept(consentVersion);
      }
    } catch (err: any) {
      console.warn('Erreur consentement :', err);
      setApiError(err.message || 'Impossible de joindre le serveur. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (recoveryCode) {
      navigator.clipboard.writeText(recoveryCode).catch(() => {});
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleComplete = () => {
    setStep('agreement');
    setHasAgreed(false);
    onAccept(consentVersion);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="modal-surface">
        {/* En-tête */}
        <div className="modal-head">
          <div className="modal-head-title">
            <div className="modal-head-badge">
              {step === 'agreement' ? <Shield size={18} /> : <Key size={18} />}
            </div>
            <div>
              <h2 id="consent-title">
                {step === 'agreement'
                  ? 'Consentement éclairé du participant'
                  : 'Votre code secret de récupération'}
              </h2>
              <span className="modal-head-sub">Version {consentVersion} • 100% anonyme</span>
            </div>
          </div>
          {onClose && step === 'agreement' && (
            <button type="button" onClick={onClose} className="btn-icon-subtle" aria-label="Fermer">
              <X size={18} />
            </button>
          )}
        </div>

        {step === 'agreement' ? (
          <>
            <div className="modal-scroll-body">
              <div className="consent-clause">
                <h4 className="consent-clause-title">1. Finalité de la collecte vocale</h4>
                <p className="consent-clause-text">
                  Les enregistrements audio collectés sont exclusivement destinés à l'entraînement et à
                  l'évaluation de modèles d'intelligence artificielle ouverts pour la langue Mina (Gẽ gbe)
                  et le français (reconnaissance de la parole STT et synthèse vocale TTS).
                </p>
              </div>

              <div className="consent-clause">
                <h4 className="consent-clause-title">2. Anonymat et absence de traceurs</h4>
                <p className="consent-clause-text">
                  Aucune information personnelle nominative (nom, téléphone, e-mail) n'est demandée.
                  Aucun traceur publicitaire n'est utilisé. Vous participez sous un identifiant pseudonyme.
                </p>
              </div>

              <div className="consent-clause">
                <h4 className="consent-clause-title">3. Droit de retrait permanent</h4>
                <p className="consent-clause-text">
                  Vous pouvez à tout moment révoquer votre consentement et déclencher la suppression
                  intégrale et définitive de tous vos enregistrements audio depuis l'application.
                </p>
              </div>

              <div className="consent-clause">
                <h4 className="consent-clause-title">4. Code secret de récupération</h4>
                <p className="consent-clause-text">
                  À l'étape suivante, un code personnel (ex : <code>MINA-XXXX-XXXX</code>) vous sera remis.
                  Conservez-le : il vous permet de reprendre votre session sur un autre appareil ou de
                  supprimer vos données ultérieurement.
                </p>
              </div>

              {apiError && (
                <div className="error-banner" role="alert">
                  <AlertTriangle size={16} />
                  <span>{apiError}</span>
                </div>
              )}

              <label className="consent-check-row">
                <input
                  id="consent-checkbox"
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                />
                <span className="consent-check-text">
                  J'ai lu et compris ces conditions. Je consens librement à l'utilisation de mes
                  enregistrements vocaux pour la recherche sur la langue Mina ({consentVersion}).
                </span>
              </label>

              {onSwitchToRecover && (
                <div className="consent-recover-hint">
                  <span>Vous avez déjà un code <code>MINA-XXXX-XXXX</code> ?</span>
                  <button
                    type="button"
                    className="consent-recover-link"
                    onClick={onSwitchToRecover}
                  >
                    Reprendre ma session
                  </button>
                </div>
              )}
            </div>

            <div className="modal-foot">
              {onClose && (
                <button type="button" className="vdt-btn-secondary vdt-btn-sm" onClick={onClose}>
                  Plus tard
                </button>
              )}
              <button
                type="button"
                id="accept-consent-btn"
                className="vdt-btn-primary vdt-btn-sm"
                disabled={!hasAgreed || isSubmitting}
                onClick={handleConfirm}
              >
                <span>{isSubmitting ? 'Validation...' : 'Accepter et obtenir mon code'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-scroll-body">
              <p className="consent-clause-text">
                Votre consentement est enregistré. Notez ou copiez votre code secret personnel :
              </p>

              <div className="recovery-code-card">
                <span className="recovery-code-eyebrow">Code secret de récupération</span>
                <div className="recovery-code-value">{recoveryCode}</div>
                <button
                  type="button"
                  id="copy-recovery-code-btn"
                  className="vdt-btn-secondary vdt-btn-sm"
                  onClick={handleCopyCode}
                >
                  {copied ? <Check size={14} className="vdt-text-vert-profond" /> : <Copy size={14} />}
                  <span>{copied ? 'Code copié !' : 'Copier mon code'}</span>
                </button>
              </div>

              <div className="recovery-info-box">
                <Key size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Important :</strong> ce code n'est affiché qu'une seule fois (il est chiffré côté
                  serveur). Il vous permet de retrouver votre progression ou d'effacer définitivement vos prises.
                </span>
              </div>
            </div>

            <div className="modal-foot">
              <button
                type="button"
                id="finish-consent-btn"
                className="vdt-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleComplete}
              >
                <span>J'ai noté mon code — Ouvrir le Studio Mina</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
