import React from 'react';
import { Mic, HardDrive, ShieldCheck, Lock, Key } from 'lucide-react';
import type { HealthInfo } from '../types';
import type { AppView } from './Navbar';

interface FooterProps {
  onOpenSessionModal: (defaultTab?: 'recover' | 'revoke') => void;
  onGoToAdmin: () => void;
  onNavigate?: (view: AppView, anchorId?: string) => void;
  health: HealthInfo | null;
}

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC<FooterProps> = ({
  onOpenSessionModal,
  onGoToAdmin,
  onNavigate,
  health
}) => {
  const handleLink = (view: AppView, anchorId?: string) => {
    if (onNavigate) {
      onNavigate(view, anchorId);
    } else if (anchorId) {
      const elem = document.getElementById(anchorId);
      if (elem) elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="vdt-footer">
      <div className="vdt-footer-inner">
        {/* Colonne gauche : Marque et descriptif */}
        <div className="vdt-footer-col-brand">
          <div className="vdt-footer-brand">
            <div className="vdt-brand-icon">
              <Mic size={16} />
            </div>
            <span className="vdt-footer-brand-title">
              Gen<span className="vdt-brand-slash">/</span>Mina
            </span>
          </div>
          <p className="vdt-footer-desc">
            Initiative indépendante et ouverte de collecte vocale dédiée à la valorisation,
            la documentation et l'intégration de la langue Mina (Gẽ gbe) dans les technologies
            numériques et l'intelligence artificielle.
          </p>
          <div className="vdt-footer-ethics-badge">
            <ShieldCheck size={14} />
            <span>Collecte éthique • Consentement éclairé • Zéro traceur commercial</span>
          </div>
        </div>

        {/* Colonne centrale : Liens de navigation */}
        <div className="vdt-footer-col-nav">
          <h4 className="vdt-footer-heading">Navigation</h4>
          <ul className="vdt-footer-list">
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('landing', 'hero')}
              >
                Accueil
              </button>
            </li>
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('landing', 'mission')}
              >
                Notre mission
              </button>
            </li>
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('landing', 'comment-participer')}
              >
                Comment participer
              </button>
            </li>
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('landing', 'pourquoi-votre-voix')}
              >
                Pourquoi votre voix compte
              </button>
            </li>
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('studio')}
              >
                Studio de collecte Mina
              </button>
            </li>
            <li>
              <button
                type="button"
                className="vdt-footer-link-btn"
                onClick={() => handleLink('progression')}
              >
                Suivi de ma progression
              </button>
            </li>
          </ul>
        </div>

        {/* Colonne droite : Confidentialité & Administration */}
        <div className="vdt-footer-col-privacy">
          <h4 className="vdt-footer-heading">Confidentialité &amp; Données</h4>
          <p className="vdt-footer-subtext">
            Chaque participant dispose d'un code secret pour reprendre sa session sur un autre appareil
            ou exercer son droit à la suppression intégrale.
          </p>

          <div className="vdt-footer-action-stack">
            <button
              type="button"
              id="footer-recover-link"
              className="vdt-btn-footer-pill"
              onClick={() => onOpenSessionModal('recover')}
            >
              <Key size={13} />
              <span>Reprendre ma session avec un code</span>
            </button>

            <button
              type="button"
              id="footer-revoke-link"
              className="vdt-btn-footer-pill"
              onClick={() => onOpenSessionModal('revoke')}
            >
              <Lock size={13} />
              <span>Gérer mon consentement / Retrait</span>
            </button>
          </div>

          <div className="vdt-footer-admin-row">
            <button
              type="button"
              id="footer-admin-link"
              className="vdt-footer-admin-link"
              onClick={onGoToAdmin}
            >
              Espace administration &amp; modération
            </button>
          </div>

          {health && (
            <div className="vdt-footer-health-tag">
              <HardDrive size={13} />
              <span>
                Stockage : {health.storageBackend === 'cloudflare_r2' ? 'Cloudflare R2' : 'Disque local'} • Base :{' '}
                {health.databaseBackend === 'cloud_firestore' ? 'Firestore' : 'Local'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Barre de bas de page */}
      <div className="vdt-footer-bottom">
        <div className="vdt-footer-bottom-inner">
          <p className="vdt-footer-copyright">
            © {CURRENT_YEAR} Gen/Mina — Donnons une voix à la langue Mina. Projet de recherche ouvert.
          </p>
          <div className="vdt-footer-disclaimer">
            Projet scientifique et citoyen indépendant. Les contributions sont soumises à la charte de consentement libre et éclairé.
          </div>
        </div>
      </div>
    </footer>
  );
};
