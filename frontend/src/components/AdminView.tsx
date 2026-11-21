import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  X,
  Play,
  Pause,
  Download,
  Trash2,
  Filter,
  RefreshCw,
  Lock,
  LogOut,
  FileUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileAudio,
  Upload
} from 'lucide-react';
import type { RecordingMetadata, Language } from '../types';
import { apiUrl, resolveAudioUrl } from '../lib/api';

interface AdminViewProps {
  languages: Language[];
  onPromptsImported?: () => void;
}

const REJECTION_PRESETS = [
  'Bruit de fond excessif',
  'Prononciation tronquée ou inaudible',
  'Erreur de lecture de la phrase',
  'Niveau sonore insuffisant (silence)',
  'Autre motif qualité'
];

export const AdminView: React.FC<AdminViewProps> = ({ languages, onPromptsImported }) => {
  // Authentification
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<string | null>(null);

  // Tableau de bord
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modales modération
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_PRESETS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Modale import corpus
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  // 1. Vérification initiale de la session
  useEffect(() => {
    let active = true;
    const verifySession = async () => {
      try {
        setIsCheckingAuth(true);
        const res = await fetch(apiUrl('/api/admin/me'), { credentials: 'include' });
        const data = await res.json();
        if (!active) return;
        if (data.authenticated) {
          setIsAuthenticated(true);
          setAdminUser(data.username || 'admin');
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn('[Admin Auth Check]', err);
        if (active) setIsAuthenticated(false);
      } finally {
        if (active) setIsCheckingAuth(false);
      }
    };

    verifySession();
    return () => {
      active = false;
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // 2. Chargement des enregistrements
  const fetchRecordings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedLanguage !== 'all') params.append('languageId', selectedLanguage);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(apiUrl(`/api/admin/recordings?${params.toString()}`), {
        credentials: 'include'
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      setRecordings(data.recordings || []);
    } catch (err: any) {
      console.error('[Admin Fetch Error]', err);
      showToast('error', 'Impossible de charger les enregistrements.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedLanguage, selectedStatus, showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const loadRecordings = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedLanguage !== 'all') params.append('languageId', selectedLanguage);
        if (selectedStatus !== 'all') params.append('status', selectedStatus);

        const res = await fetch(apiUrl(`/api/admin/recordings?${params.toString()}`), {
          credentials: 'include'
        });

        if (!active) return;
        if (res.status === 401) {
          setIsAuthenticated(false);
          return;
        }
        const data = await res.json();
        if (active) setRecordings(data.recordings || []);
      } catch (err) {
        console.error('[Admin Fetch Error]', err);
        if (active) showToast('error', 'Impossible de charger les enregistrements.');
      }
    };
    loadRecordings();
    return () => {
      active = false;
    };
  }, [isAuthenticated, selectedLanguage, selectedStatus, showToast]);

  // Connexion
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoggingIn(true);
      setLoginError(null);

      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Échec de l'authentification.");
        return;
      }

      setIsAuthenticated(true);
      setAdminUser(data.user?.username || loginUsername);
      setLoginPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Impossible de joindre le serveur.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Déconnexion
  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/admin/logout'), {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[Logout Error]', err);
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setPlayingAudioId(null);
    setIsAuthenticated(false);
    setAdminUser(null);
    setRecordings([]);
  };

  // Lecture audio
  const handleTogglePlay = (recording: RecordingMetadata) => {
    if (playingAudioId === recording.id && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setPlayingAudioId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    const audio = new Audio(resolveAudioUrl(recording.audioUrl));
    audio.play().catch((err) => {
      console.error('Erreur lecture audio :', err);
      showToast('error', 'Impossible de lire ce fichier audio.');
      setPlayingAudioId(null);
    });
    audio.onended = () => {
      setPlayingAudioId(null);
      currentAudioRef.current = null;
    };

    currentAudioRef.current = audio;
    setPlayingAudioId(recording.id);
  };

  // Validation
  const handleValidate = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/recordings/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'validated',
          reviewedBy: adminUser || 'admin'
        })
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Prise validée pour le jeu de données.');
        fetchRecordings();
      } else {
        showToast('error', data.error || 'Erreur lors de la validation.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Erreur réseau.');
    }
  };

  // Rejet
  const handleReject = async (id: string) => {
    const finalReason =
      rejectionReason === 'Autre motif qualité' && customRejectionReason.trim()
        ? customRejectionReason.trim()
        : rejectionReason;

    try {
      const res = await fetch(apiUrl(`/api/admin/recordings/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: finalReason,
          reviewedBy: adminUser || 'admin'
        })
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Prise marquée comme rejetée.');
        setRejectionModalId(null);
        setCustomRejectionReason('');
        fetchRecordings();
      } else {
        showToast('error', data.error || 'Erreur lors du rejet.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Erreur réseau.');
    }
  };

  // Suppression définitive
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/recordings/${deleteConfirmId}`), {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        showToast('success', 'Prise audio et métadonnées supprimées définitivement.');
        setDeleteConfirmId(null);
        fetchRecordings();
      } else {
        showToast('error', data.error || 'Erreur lors de la suppression.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Erreur réseau.');
    }
  };

  // Export authentifié (compatible cross-domain via fetch + blob)
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(apiUrl(`/api/admin/export?format=${format}`), {
        credentials: 'include'
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) {
        throw new Error("Impossible d'exporter le dataset.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gen_mina_dataset_validated.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('success', `Export ${format.toUpperCase()} téléchargé.`);
    } catch (err: any) {
      showToast('error', err.message || "Échec de l'export.");
    }
  };

  // Lecture fichier JSON local pour l'import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportJsonText(reader.result);
        setImportStatus(null);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Import de corpus
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsImporting(true);
      setImportStatus(null);

      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(importJsonText);
      } catch {
        setImportStatus({ type: 'error', text: 'Format JSON invalide. Veuillez vérifier la syntaxe.' });
        return;
      }

      const res = await fetch(apiUrl('/api/admin/prompts/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsedPayload)
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setImportStatus({ type: 'error', text: data.error || "Erreur lors de l'importation." });
        return;
      }

      setImportStatus({ type: 'success', text: data.message });
      onPromptsImported?.();
      window.setTimeout(() => {
        setShowImportModal(false);
        setImportJsonText('');
        setImportStatus(null);
      }, 1500);
    } catch (err: any) {
      setImportStatus({ type: 'error', text: err.message || "Erreur lors de l'import." });
    } finally {
      setIsImporting(false);
    }
  };

  // Statistiques réelles calculées sur les enregistrements affichés
  const pendingCount = recordings.filter((r) => r.status === 'pending').length;
  const validatedCount = recordings.filter((r) => r.status === 'validated').length;
  const rejectedCount = recordings.filter((r) => r.status === 'rejected').length;
  const totalValidatedSec = recordings
    .filter((r) => r.status === 'validated')
    .reduce((acc, r) => acc + (r.durationSeconds || 0), 0);

  const formatDurationSummary = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  if (isCheckingAuth) {
    return (
      <div className="admin-loading-state">
        <RefreshCw size={28} className="animate-spin" />
        <span>Vérification de la session administrateur...</span>
      </div>
    );
  }

  // ÉCRAN DE CONNEXION
  if (!isAuthenticated) {
    return (
      <div className="admin-login-shell">
        <div className="admin-login-card">
          <div className="admin-login-head">
            <div className="admin-login-icon">
              <Lock size={20} />
            </div>
            <h1>Espace Administration</h1>
            <p>Accès réservé aux modérateurs du corpus Gen/Mina</p>
          </div>

          {loginError && (
            <div className="error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="admin-login-form">
            <div>
              <label htmlFor="admin-username-input" className="field-label">
                Identifiant
              </label>
              <input
                id="admin-username-input"
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="admin-password-input" className="field-label">
                Mot de passe
              </label>
              <input
                id="admin-password-input"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <button
              id="admin-login-btn"
              type="submit"
              className="vdt-btn-primary"
              disabled={isLoggingIn}
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
            >
              {isLoggingIn ? 'Vérification...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // TABLEAU DE BORD MODÉRATION
  return (
    <div className="admin-wrapper">
      <div className="admin-header-row">
        <div className="admin-title-group">
          <span className="vdt-section-tag" style={{ marginBottom: '8px' }}>
            MODÉRATION &amp; DATASET
          </span>
          <h1>Console d'administration</h1>
          <p>
            Connecté en tant que <strong>{adminUser}</strong>
          </p>
        </div>

        <div className="admin-actions-cluster">
          <button
            type="button"
            id="admin-import-prompts-btn"
            className="vdt-btn-primary vdt-btn-sm"
            onClick={() => setShowImportModal(true)}
          >
            <FileUp size={15} />
            <span>Importer corpus</span>
          </button>

          <button
            type="button"
            id="admin-export-json-btn"
            className="vdt-btn-secondary vdt-btn-sm"
            onClick={() => handleExport('json')}
          >
            <Download size={15} />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            id="admin-export-csv-btn"
            className="vdt-btn-secondary vdt-btn-sm"
            onClick={() => handleExport('csv')}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            id="admin-logout-btn"
            className="vdt-btn-secondary vdt-btn-sm"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* KPIs réels */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon">
            <FileAudio size={18} />
          </div>
          <div>
            <div className="admin-kpi-value">{recordings.length}</div>
            <div className="admin-kpi-label">Prises affichées</div>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon pending">
            <Clock size={18} />
          </div>
          <div>
            <div className="admin-kpi-value">{pendingCount}</div>
            <div className="admin-kpi-label">En attente</div>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon validated">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="admin-kpi-value">{validatedCount}</div>
            <div className="admin-kpi-label">Validées ({rejectedCount} rejetées)</div>
          </div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon duration">
            <Play size={18} />
          </div>
          <div>
            <div className="admin-kpi-value">{formatDurationSummary(totalValidatedSec)}</div>
            <div className="admin-kpi-label">Audio validé</div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={toast.type === 'error' ? 'error-banner' : 'success-banner'} role="status">
          {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Filtres */}
      <div className="admin-controls-card">
        <div className="admin-filter-group">
          <Filter size={16} style={{ color: 'var(--vdt-texte-doux)' }} />
          <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Filtrer :</span>

          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            aria-label="Filtrer par langue"
          >
            <option value="all">Toutes les langues</option>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.nativeName})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente (pending)</option>
            <option value="validated">Validées (validated)</option>
            <option value="rejected">Rejetées (rejected)</option>
          </select>
        </div>

        <button
          type="button"
          className="vdt-btn-secondary vdt-btn-sm"
          onClick={fetchRecordings}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Tableau */}
      <div className="admin-table-container">
        {recordings.length === 0 ? (
          <div className="admin-empty-table">
            Aucun enregistrement ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Audio</th>
                <th>Langue</th>
                <th>Phrase</th>
                <th>Participant</th>
                <th>Durée</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((rec) => {
                const isPlaying = playingAudioId === rec.id;
                return (
                  <tr key={rec.id}>
                    <td>
                      <button
                        type="button"
                        className={`admin-play-btn ${isPlaying ? 'playing' : ''}`}
                        onClick={() => handleTogglePlay(rec)}
                        title={isPlaying ? 'Pause' : 'Écouter'}
                        aria-label={isPlaying ? 'Pause' : 'Écouter'}
                      >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </td>

                    <td>
                      <span className="admin-lang-chip">{rec.languageId}</span>
                    </td>

                    <td style={{ maxWidth: '320px' }}>
                      <div className="admin-prompt-text">« {rec.promptText} »</div>
                      <div className="admin-prompt-meta">
                        {rec.promptId} • Prise n° {rec.takeNumber}
                      </div>
                    </td>

                    <td>
                      <span className="admin-mono-id">{rec.speakerId.slice(0, 12)}</span>
                    </td>

                    <td>
                      <span className="admin-duration">
                        {rec.durationSeconds ? `${rec.durationSeconds}s` : '—'}
                      </span>
                    </td>

                    <td>
                      <span className={`status-badge ${rec.status}`}>
                        {rec.status === 'validated' && 'Validée'}
                        {rec.status === 'pending' && 'En attente'}
                        {rec.status === 'rejected' && 'Rejetée'}
                      </span>
                      {rec.rejectionReason && (
                        <div className="admin-reject-reason">{rec.rejectionReason}</div>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-row-actions">
                        {rec.status !== 'validated' && (
                          <button
                            type="button"
                            className="admin-action-icon approve"
                            onClick={() => handleValidate(rec.id)}
                            title="Valider la prise"
                            aria-label="Valider la prise"
                          >
                            <Check size={15} />
                          </button>
                        )}

                        {rec.status !== 'rejected' && (
                          <button
                            type="button"
                            className="admin-action-icon reject"
                            onClick={() => {
                              setRejectionModalId(rec.id);
                              setRejectionReason(REJECTION_PRESETS[0]);
                              setCustomRejectionReason('');
                            }}
                            title="Rejeter la prise"
                            aria-label="Rejeter la prise"
                          >
                            <X size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="admin-action-icon delete"
                          onClick={() => setDeleteConfirmId(rec.id)}
                          title="Supprimer définitivement"
                          aria-label="Supprimer définitivement"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modale motif de rejet */}
      {rejectionModalId && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-surface" style={{ maxWidth: '440px' }}>
            <div className="modal-head">
              <div className="modal-head-title">
                <h2>Motif de rejet</h2>
              </div>
              <button type="button" onClick={() => setRejectionModalId(null)} className="btn-icon-subtle">
                <X size={18} />
              </button>
            </div>
            <div className="modal-scroll-body">
              <label htmlFor="reject-reason-select" className="field-label">
                Sélectionnez la raison du rejet :
              </label>
              <select
                id="reject-reason-select"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: '100%' }}
              >
                {REJECTION_PRESETS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>

              {rejectionReason === 'Autre motif qualité' && (
                <div>
                  <label htmlFor="custom-reject-input" className="field-label">
                    Précisez le motif :
                  </label>
                  <input
                    id="custom-reject-input"
                    type="text"
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Ex: Coupure en fin de phrase..."
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="vdt-btn-secondary vdt-btn-sm"
                onClick={() => setRejectionModalId(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="vdt-btn-danger vdt-btn-sm"
                onClick={() => handleReject(rejectionModalId)}
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale confirmation suppression */}
      {deleteConfirmId && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-surface" style={{ maxWidth: '420px' }}>
            <div className="modal-head">
              <div className="modal-head-title">
                <div className="modal-head-badge danger">
                  <Trash2 size={17} />
                </div>
                <h2>Supprimer cette prise ?</h2>
              </div>
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="btn-icon-subtle">
                <X size={18} />
              </button>
            </div>
            <div className="modal-scroll-body">
              <p className="consent-clause-text">
                Le fichier audio et ses métadonnées seront supprimés définitivement du stockage et de la base.
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="vdt-btn-secondary vdt-btn-sm"
                onClick={() => setDeleteConfirmId(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="vdt-btn-danger vdt-btn-sm"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} />
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale import corpus */}
      {showImportModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-surface" style={{ maxWidth: '580px' }}>
            <div className="modal-head">
              <div className="modal-head-title">
                <div className="modal-head-badge">
                  <FileUp size={17} />
                </div>
                <h2>Importer un lot de phrases</h2>
              </div>
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-icon-subtle">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div className="modal-scroll-body">
                <p className="consent-clause-text">
                  Chargez un fichier <code>.json</code> ou collez un tableau JSON conforme au schéma{' '}
                  <code>Prompt</code> (id, languageId, text, category).
                </p>

                <div className="import-file-row">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="vdt-btn-secondary vdt-btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    <span>Charger un fichier .json</span>
                  </button>
                </div>

                {importStatus && (
                  <div className={importStatus.type === 'error' ? 'error-banner' : 'success-banner'}>
                    <span>{importStatus.text}</span>
                  </div>
                )}

                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[\n  {\n    "id": "mina-ext-01",\n    "languageId": "mina",\n    "text": "Eŋuti fafa le mia gbɔ a ?",\n    "category": "daily_life",\n    "difficulty": "easy"\n  }\n]`}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
                  required
                />
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="vdt-btn-secondary vdt-btn-sm"
                  onClick={() => setShowImportModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="vdt-btn-primary vdt-btn-sm"
                  disabled={isImporting}
                >
                  {isImporting ? 'Importation...' : 'Importer les phrases'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
