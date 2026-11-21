import { useState, useEffect, useCallback } from 'react';
import { Navbar, type AppView } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { CollectStudio } from './components/CollectStudio';
import { ProgressionView } from './components/ProgressionView';
import { ConsentModal } from './components/ConsentModal';
import { RevokeConsentModal } from './components/RevokeConsentModal';
import { AdminView } from './components/AdminView';
import { Footer } from './components/Footer';
import { apiUrl } from './lib/api';
import type { Language, Prompt, RecordingMetadata, HealthInfo } from './types';
import './App.css';

function getInitialViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'landing';
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  if (pathname === '/admin' || hash === '#admin') return 'admin';
  if (pathname === '/studio' || hash === '#studio') return 'studio';
  if (pathname === '/progression' || hash === '#progression') return 'progression';
  return 'landing';
}

function getOrCreateSpeakerId(): string {
  if (typeof window === 'undefined') return '';
  let saved = localStorage.getItem('gen_mina_speaker_id');
  if (!saved) {
    const rand = Math.random().toString(36).slice(2, 8);
    saved = `spk_${Date.now().toString(36)}_${rand}`;
    localStorage.setItem('gen_mina_speaker_id', saved);
  }
  return saved;
}

export function App() {
  // Navigation synchronisée avec l'URL
  const [currentView, setCurrentView] = useState<AppView>(() => getInitialViewFromLocation());

  // Données serveur
  const [languages, setLanguages] = useState<Language[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('mina');
  const [unrecordedOnly, setUnrecordedOnly] = useState<boolean>(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  // Consentement & Locuteur pseudonyme
  const [speakerId, setSpeakerId] = useState<string>(() => getOrCreateSpeakerId());
  const [consentGiven, setConsentGiven] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('gen_mina_consent_given') === 'true'
  );
  const [consentVersion, setConsentVersion] = useState<string>(
    () => (typeof window !== 'undefined' && localStorage.getItem('gen_mina_consent_version')) || 'v1.0-2026-10'
  );

  // Modales
  const [isConsentModalOpen, setIsConsentModalOpen] = useState<boolean>(false);
  const [sessionModalState, setSessionModalState] = useState<{
    open: boolean;
    tab: 'recover' | 'revoke';
  }>({ open: false, tab: 'recover' });

  // Compteur de prises de la session active
  const [sessionTakesCount, setSessionTakesCount] = useState<number>(0);

  // Synchronisation URL <-> historique navigateur
  const navigateTo = useCallback((view: AppView, anchorId?: string) => {
    setCurrentView(view);
    const targetPath = view === 'landing' ? '/' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }

    if (anchorId) {
      window.setTimeout(() => {
        const elem = document.getElementById(anchorId);
        if (elem) elem.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getInitialViewFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Chargement des phrases enrichies du statut participant
  const refreshPrompts = useCallback((spkId: string) => {
    const url = spkId
      ? apiUrl(`/api/prompts?speakerId=${encodeURIComponent(spkId)}`)
      : apiUrl('/api/prompts');
    fetch(url)
      .then((res) => res.json())
      .then((data: Prompt[]) => {
        if (Array.isArray(data)) {
          setPrompts(data);
        }
      })
      .catch((err) => console.error('Erreur chargement phrases :', err));
  }, []);

  // Vérification initiale health + langues
  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Erreur health check :', err));

    fetch(apiUrl('/api/languages'))
      .then((res) => res.json())
      .then((data: Language[]) => {
        if (Array.isArray(data)) {
          setLanguages(data);
          const hasMina = data.some((l) => l.id === 'mina');
          setSelectedLanguageId(hasMina ? 'mina' : data[0]?.id || 'mina');
        }
      })
      .catch((err) => console.error('Erreur chargement langues :', err));
  }, []);

  // Synchronisation réelle du consentement avec le serveur + phrases du locuteur
  useEffect(() => {
    if (!speakerId) return;
    refreshPrompts(speakerId);

    fetch(apiUrl(`/api/consent/${encodeURIComponent(speakerId)}`))
      .then((res) => res.json())
      .then((data) => {
        if (data.consentGiven) {
          localStorage.setItem('gen_mina_consent_given', 'true');
          if (data.consentVersion) {
            localStorage.setItem('gen_mina_consent_version', data.consentVersion);
            setConsentVersion(data.consentVersion);
          }
          setConsentGiven(true);
        } else {
          localStorage.removeItem('gen_mina_consent_given');
          setConsentGiven(false);
        }
      })
      .catch(() => {
        // En cas de perte réseau temporaire, ne pas casser l'état local
      });
  }, [speakerId, refreshPrompts]);

  // Filtrage des phrases selon la langue sélectionnée (et option "non enregistrées")
  const languagePrompts = prompts.filter((p) => p.languageId === selectedLanguageId);
  const studioPrompts = unrecordedOnly
    ? languagePrompts.filter((p) => !p.participantStatus?.completed)
    : languagePrompts;

  const safeStudioIndex =
    studioPrompts.length > 0 ? Math.min(currentPromptIndex, studioPrompts.length - 1) : 0;

  const handleSelectLanguage = (langId: string) => {
    setSelectedLanguageId(langId);
    setCurrentPromptIndex(0);
  };

  const handleToggleUnrecordedOnly = () => {
    setUnrecordedOnly((prev) => !prev);
    setCurrentPromptIndex(0);
  };

  const handleNextPrompt = () => {
    if (safeStudioIndex < studioPrompts.length - 1) {
      setCurrentPromptIndex(safeStudioIndex + 1);
    }
  };

  const handlePrevPrompt = () => {
    if (safeStudioIndex > 0) {
      setCurrentPromptIndex(safeStudioIndex - 1);
    }
  };

  const handleRandomPrompt = () => {
    if (studioPrompts.length > 1) {
      let rand = Math.floor(Math.random() * studioPrompts.length);
      while (rand === safeStudioIndex) {
        rand = Math.floor(Math.random() * studioPrompts.length);
      }
      setCurrentPromptIndex(rand);
    }
  };

  const handleStartCollectFlow = () => {
    if (!consentGiven) {
      setIsConsentModalOpen(true);
    } else {
      navigateTo('studio');
    }
  };

  const handleConsentAccept = (version: string) => {
    localStorage.setItem('gen_mina_consent_given', 'true');
    localStorage.setItem('gen_mina_consent_version', version);
    setConsentGiven(true);
    setConsentVersion(version);
    setIsConsentModalOpen(false);
    navigateTo('studio');
    if (speakerId) {
      refreshPrompts(speakerId);
    }
  };

  const handleRecoverSession = (recoveredSpeakerId: string, version: string) => {
    localStorage.setItem('gen_mina_speaker_id', recoveredSpeakerId);
    localStorage.setItem('gen_mina_consent_given', 'true');
    localStorage.setItem('gen_mina_consent_version', version);
    setSpeakerId(recoveredSpeakerId);
    setConsentGiven(true);
    setConsentVersion(version);
    setCurrentPromptIndex(0);
    refreshPrompts(recoveredSpeakerId);
    navigateTo('studio');
  };

  const handleRevokeSuccess = () => {
    localStorage.removeItem('gen_mina_consent_given');
    localStorage.removeItem('gen_mina_consent_version');
    const newSpeakerId = `spk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('gen_mina_speaker_id', newSpeakerId);
    setSpeakerId(newSpeakerId);
    setConsentGiven(false);
    setSessionTakesCount(0);
    setCurrentPromptIndex(0);
    navigateTo('landing');
    refreshPrompts(newSpeakerId);
  };

  const handleRecordingSaved = (_rec: RecordingMetadata) => {
    setSessionTakesCount((prev) => prev + 1);
    if (speakerId) {
      refreshPrompts(speakerId);
    }
  };

  return (
    <div className="app-shell">
      <Navbar
        currentView={currentView}
        setCurrentView={navigateTo}
        speakerId={speakerId}
        hasConsent={consentGiven}
        onOpenConsentModal={() => setIsConsentModalOpen(true)}
        onOpenSessionModal={(tab = 'recover') => setSessionModalState({ open: true, tab })}
        onStartCollect={handleStartCollectFlow}
        health={health}
      />

      <main className="main-wrapper">
        {currentView === 'landing' && (
          <LandingView
            onStartCollect={handleStartCollectFlow}
            hasConsent={consentGiven}
            onOpenConsentModal={() => setIsConsentModalOpen(true)}
            prompts={prompts}
            sessionTakesCount={sessionTakesCount}
          />
        )}

        {currentView === 'studio' && (
          <div className="content-container">
            <CollectStudio
              languages={languages}
              selectedLanguageId={selectedLanguageId}
              onSelectLanguage={handleSelectLanguage}
              unrecordedOnly={unrecordedOnly}
              onToggleUnrecordedOnly={handleToggleUnrecordedOnly}
              prompts={studioPrompts}
              currentIndex={safeStudioIndex}
              onNextPrompt={handleNextPrompt}
              onPrevPrompt={handlePrevPrompt}
              onRandomPrompt={handleRandomPrompt}
              onGoToProgression={() => navigateTo('progression')}
              speakerId={speakerId}
              consentVersion={consentVersion}
              onRecordingSaved={handleRecordingSaved}
              onConsentInvalidated={() => {
                localStorage.removeItem('gen_mina_consent_given');
                setConsentGiven(false);
                setIsConsentModalOpen(true);
              }}
            />
          </div>
        )}

        {currentView === 'progression' && (
          <div className="content-container">
            <ProgressionView
              prompts={languagePrompts}
              currentIndex={currentPromptIndex}
              onSelectPromptIndex={(idx) => {
                setUnrecordedOnly(false);
                setCurrentPromptIndex(idx);
              }}
              onBackToStudio={() => handleStartCollectFlow()}
              onOpenRecoverModal={() => setSessionModalState({ open: true, tab: 'recover' })}
              sessionTakesCount={sessionTakesCount}
              selectedLanguageId={selectedLanguageId}
            />
          </div>
        )}

        {currentView === 'admin' && (
          <div className="content-container admin-container-wide">
            <AdminView
              languages={languages}
              onPromptsImported={() => {
                if (speakerId) refreshPrompts(speakerId);
              }}
            />
          </div>
        )}
      </main>

      <Footer
        onOpenSessionModal={(tab = 'recover') => setSessionModalState({ open: true, tab })}
        onGoToAdmin={() => navigateTo('admin')}
        onNavigate={navigateTo}
        health={health}
      />

      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        speakerId={speakerId}
        onAccept={handleConsentAccept}
        onSwitchToRecover={() => {
          setIsConsentModalOpen(false);
          setSessionModalState({ open: true, tab: 'recover' });
        }}
      />

      <RevokeConsentModal
        key={sessionModalState.open ? `open-${sessionModalState.tab}` : 'closed'}
        isOpen={sessionModalState.open}
        initialTab={sessionModalState.tab}
        onClose={() => setSessionModalState((prev) => ({ ...prev, open: false }))}
        speakerId={speakerId}
        onRevokeSuccess={handleRevokeSuccess}
        onRecoverSuccess={handleRecoverSession}
      />
    </div>
  );
}

export default App;
