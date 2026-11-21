import React, { useState } from 'react';
import { Mic, BarChart3, Home, Key, Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';
import type { HealthInfo } from '../types';

export type AppView = 'landing' | 'studio' | 'progression' | 'admin';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView, anchorId?: string) => void;
  speakerId: string;
  hasConsent: boolean;
  onOpenConsentModal: () => void;
  onOpenSessionModal: (defaultTab?: 'recover' | 'revoke') => void;
  onStartCollect: () => void;
  health: HealthInfo | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  hasConsent,
  onOpenConsentModal,
  onOpenSessionModal,
  onStartCollect
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: AppView, anchorId?: string) => {
    setCurrentView(view, anchorId);
    setMobileMenuOpen(false);
  };

  const isInAppWorkspace = currentView === 'studio' || currentView === 'progression';

  return (
    <header className="vdt-header">
      <div className="vdt-header-inner">
        {/* Gauche : Identité épurée sur une seule ligne */}
        <button
          type="button"
          className="vdt-brand-container"
          onClick={() => handleNavClick('landing')}
          aria-label="Retour à l'accueil Gen/Mina"
        >
          <span className="vdt-brand-icon">
            <Mic size={17} />
          </span>
          <span className="vdt-brand-title">
            Gen<span className="vdt-brand-slash">/</span>Mina
          </span>
        </button>

        {/* Centre : Navigation contextuelle, aérée, jamais sur 2 lignes */}
        {currentView === 'landing' && (
          <nav className="vdt-nav-desktop" aria-label="Navigation principale">
            <button
              type="button"
              id="nav-landing-btn"
              className="vdt-nav-link active"
              onClick={() => handleNavClick('landing', 'hero')}
            >
              Accueil
            </button>
            <button
              type="button"
              id="nav-mission-btn"
              className="vdt-nav-link"
              onClick={() => handleNavClick('landing', 'mission')}
            >
              Notre mission
            </button>
            <button
              type="button"
              id="nav-participate-steps-btn"
              className="vdt-nav-link"
              onClick={() => handleNavClick('landing', 'comment-participer')}
            >
              Comment participer
            </button>
            <button
              type="button"
              id="nav-about-btn"
              className="vdt-nav-link"
              onClick={() => handleNavClick('landing', 'pourquoi-votre-voix')}
            >
              À propos
            </button>
          </nav>
        )}

        {isInAppWorkspace && (
          <nav className="vdt-nav-segmented" aria-label="Navigation du studio">
            <button
              type="button"
              id="nav-back-landing-btn"
              className="vdt-seg-link"
              onClick={() => handleNavClick('landing')}
            >
              <Home size={14} />
              <span>Accueil</span>
            </button>
            <button
              type="button"
              id="nav-studio-btn"
              className={`vdt-seg-link ${currentView === 'studio' ? 'active' : ''}`}
              onClick={() => {
                if (!hasConsent) {
                  onOpenConsentModal();
                } else {
                  handleNavClick('studio');
                }
              }}
            >
              <Mic size={14} />
              <span>Studio Mina</span>
            </button>
            <button
              type="button"
              id="nav-progression-btn"
              className={`vdt-seg-link ${currentView === 'progression' ? 'active' : ''}`}
              onClick={() => handleNavClick('progression')}
            >
              <BarChart3 size={14} />
              <span>Progression</span>
            </button>
          </nav>
        )}

        {currentView === 'admin' && (
          <div className="vdt-admin-nav-pill">Espace Modération</div>
        )}

        {/* Droite : Actions propres et équilibrées */}
        <div className="vdt-header-actions">
          {currentView !== 'admin' && (
            <button
              type="button"
              id="header-session-btn"
              className="vdt-btn-header-ghost"
              onClick={() => onOpenSessionModal('recover')}
              title="Reprendre une session avec votre code MINA ou gérer vos données"
            >
              <Key size={14} />
              <span>Mon code</span>
            </button>
          )}

          {currentView === 'landing' && (
            <button
              type="button"
              id="nav-cta-participate"
              className="vdt-btn-header-cta"
              onClick={onStartCollect}
            >
              <span>Participer</span>
              <ArrowRight size={15} />
            </button>
          )}

          {currentView === 'progression' && (
            <button
              type="button"
              id="nav-cta-studio"
              className="vdt-btn-header-cta"
              onClick={onStartCollect}
            >
              <Mic size={14} />
              <span>Enregistrer</span>
            </button>
          )}

          {currentView === 'admin' && (
            <button
              type="button"
              className="vdt-btn-header-cta"
              onClick={() => handleNavClick('landing')}
            >
              <Home size={15} />
              <span>Retour au site</span>
            </button>
          )}

          {currentView !== 'admin' && (
            <button
              type="button"
              className="vdt-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          )}
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {mobileMenuOpen && currentView !== 'admin' && (
        <div className="vdt-mobile-dropdown">
          <div className="vdt-mobile-links">
            <button
              type="button"
              className={`vdt-mobile-link ${currentView === 'landing' ? 'active' : ''}`}
              onClick={() => handleNavClick('landing')}
            >
              <Home size={16} />
              <span>Accueil</span>
            </button>
            <button
              type="button"
              className="vdt-mobile-link"
              onClick={() => handleNavClick('landing', 'mission')}
            >
              <span>Notre mission</span>
            </button>
            <button
              type="button"
              className="vdt-mobile-link"
              onClick={() => handleNavClick('landing', 'comment-participer')}
            >
              <span>Comment participer</span>
            </button>
            <button
              type="button"
              className="vdt-mobile-link"
              onClick={() => handleNavClick('landing', 'pourquoi-votre-voix')}
            >
              <span>À propos</span>
            </button>

            <div className="vdt-mobile-divider" />

            <button
              type="button"
              className={`vdt-mobile-link ${currentView === 'studio' ? 'active' : ''}`}
              onClick={() => {
                setMobileMenuOpen(false);
                if (!hasConsent) {
                  onOpenConsentModal();
                } else {
                  setCurrentView('studio');
                }
              }}
            >
              <Mic size={16} />
              <span>Studio Mina</span>
            </button>
            <button
              type="button"
              className={`vdt-mobile-link ${currentView === 'progression' ? 'active' : ''}`}
              onClick={() => handleNavClick('progression')}
            >
              <BarChart3 size={16} />
              <span>Ma Progression</span>
            </button>
          </div>

          <div className="vdt-mobile-cta-box">
            <button
              type="button"
              className="vdt-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setMobileMenuOpen(false);
                onStartCollect();
              }}
            >
              <span>Participer à la collecte</span>
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="vdt-mobile-revoke-link"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSessionModal('recover');
              }}
            >
              <ShieldCheck size={14} />
              <span>Mon code / Reprendre ou supprimer mes données</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
