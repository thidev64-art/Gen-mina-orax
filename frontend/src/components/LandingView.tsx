import React, { useState } from 'react';
import {
  Mic,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Globe,
  Users,
  Cpu,
  Layers,
  ChevronRight,
  BookOpen,
  Headphones,
  Check
} from 'lucide-react';
import heroVoiceImg from '../assets/hero-mina-voice.jpg';
import type { Prompt } from '../types';

interface LandingViewProps {
  onStartCollect: () => void;
  hasConsent: boolean;
  onOpenConsentModal: () => void;
  prompts: Prompt[];
  sessionTakesCount: number;
}

const MINA_EXPRESSIONS = [
  { text: 'Ndi na mi', translation: 'Bonjour à tous', category: 'Salutation' },
  { text: 'Efoa ?', translation: 'Comment ça va ?', category: 'Quotidien' },
  { text: 'Akpé kaka', translation: 'Merci beaucoup', category: 'Gratitude' },
  { text: 'Mia dogo', translation: 'À bientôt', category: 'Départ' }
];

const WAVE_HEIGHTS = [38, 72, 46, 94, 62, 86, 40, 78, 96, 54, 68, 42];

export const LandingView: React.FC<LandingViewProps> = ({
  onStartCollect,
  hasConsent,
  onOpenConsentModal,
  prompts,
  sessionTakesCount
}) => {
  const minaPrompts = prompts.filter((p) => p.languageId === 'mina');
  const countMina = minaPrompts.length;

  const [selectedExpression, setSelectedExpression] = useState(MINA_EXPRESSIONS[0]);
  const [pulseWave, setPulseWave] = useState(false);

  const handleSelectExpression = (exp: (typeof MINA_EXPRESSIONS)[number]) => {
    setSelectedExpression(exp);
    setPulseWave(true);
    window.setTimeout(() => setPulseWave(false), 950);
  };

  return (
    <div className="landing-page">
      {/* ========================================================
          SECTION B : HERO SECTION (ÉDITORIAL & VISUEL FORT)
          ======================================================== */}
      <section className="vdt-hero-section" id="hero">
        <div className="vdt-hero-grid">
          {/* Colonne gauche : Typographie éditoriale & actions */}
          <div className="vdt-hero-content">
            <div className="vdt-badge-pill">
              <span className="vdt-badge-dot" />
              <span>LANGUE MINA • GẼ GBE</span>
            </div>

            <h1 className="vdt-hero-title">
              Donnons une voix à la{' '}
              <span className="vdt-title-highlight">langue Mina.</span>
            </h1>

            <p className="vdt-hero-lead">
              Gen/Mina est un projet ouvert de collecte de voix en Mina (Gẽ gbe). En enregistrant
              quelques phrases simples, vous contribuez à préserver notre langue et à préparer sa
              présence dans les technologies vocales de demain.
            </p>

            <div className="vdt-hero-actions">
              <button
                type="button"
                id="hero-participate-btn"
                className="vdt-btn-primary vdt-btn-hero-lg"
                onClick={onStartCollect}
              >
                <span>{hasConsent ? 'Accéder au Studio Mina' : 'Participer à la collecte'}</span>
                <ArrowRight size={18} />
              </button>

              <a href="#mission" className="vdt-btn-secondary vdt-btn-hero-lg">
                <span>Découvrir le projet</span>
              </a>
            </div>

            <div className="vdt-hero-guarantees">
              <div className="vdt-guarantee-item">
                <ShieldCheck size={15} className="vdt-text-vert-profond" />
                <span>100% anonyme &amp; sans traceur</span>
              </div>
              <div className="vdt-guarantee-sep">•</div>
              <div className="vdt-guarantee-item">
                <CheckCircle2 size={15} className="vdt-text-vert-profond" />
                <span>Code de retrait à tout moment</span>
              </div>
              {countMina > 0 && (
                <>
                  <div className="vdt-guarantee-sep">•</div>
                  <div className="vdt-guarantee-item">
                    <BookOpen size={15} className="vdt-text-vert-profond" />
                    <span>{countMina} phrases disponibles</span>
                  </div>
                </>
              )}
            </div>

            {sessionTakesCount > 0 && (
              <div className="vdt-session-active-pill">
                <Check size={14} />
                <span>
                  Session active : <strong>{sessionTakesCount}</strong> prise(s) enregistrée(s)
                </span>
              </div>
            )}
          </div>

          {/* Colonne droite : Visuel éditorial fort + dock vocal Mina flottant */}
          <div className="vdt-hero-visual-col">
            <div className="vdt-hero-stage">
              {/* Accent architectural vert lime inspiré de Voix du Togo */}
              <div className="vdt-hero-stage-accent" aria-hidden="true" />

              {/* Cadre photographique principal */}
              <div className="vdt-hero-photo-frame">
                <img
                  src={heroVoiceImg}
                  alt="Locutrice enregistrant sa voix en langue Mina sur son téléphone"
                  className="vdt-hero-photo"
                  loading="eager"
                />
                <div className="vdt-hero-photo-vignette" aria-hidden="true" />

                {/* Pastille flottante haut gauche */}
                <div className="vdt-hero-floating-tag">
                  <span className="vdt-pulse-dot" />
                  <span>Mina (Gẽ gbe)</span>
                  <span className="vdt-floating-tag-sep">·</span>
                  <span className="vdt-floating-tag-region">Togo &amp; Bénin</span>
                </div>

                {/* Dock vocal interactif flottant en bas */}
                <div className="vdt-hero-voice-dock">
                  <div className="vdt-voice-dock-top">
                    <div className="vdt-voice-dock-phrase">
                      <span className="vdt-voice-dock-mina">« {selectedExpression.text} »</span>
                      <span className="vdt-voice-dock-fr">
                        {selectedExpression.translation} • {selectedExpression.category}
                      </span>
                    </div>

                    <div className="vdt-voice-dock-right">
                      <div className="vdt-dock-bars" aria-hidden="true">
                        {WAVE_HEIGHTS.map((h, i) => (
                          <span
                            key={i}
                            className={`vdt-dock-bar ${pulseWave ? 'active' : ''}`}
                            style={{
                              height: `${pulseWave ? h : Math.round(h * 0.58)}%`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="vdt-dock-mic-btn"
                        onClick={onStartCollect}
                        title="Ouvrir le studio d'enregistrement"
                        aria-label="Enregistrer votre voix dans le studio"
                      >
                        <Mic size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="vdt-voice-dock-chips" role="group" aria-label="Expressions en Mina">
                    {MINA_EXPRESSIONS.map((exp) => (
                      <button
                        key={exp.text}
                        type="button"
                        className={`vdt-dock-chip ${selectedExpression.text === exp.text ? 'selected' : ''}`}
                        onClick={() => handleSelectExpression(exp)}
                      >
                        {exp.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          BANDEAU DE SYNTHÈSE (METRICS STRIP)
          ======================================================== */}
      <section className="vdt-metrics-strip">
        <div className="vdt-metrics-grid">
          <div className="vdt-metric-card">
            <div className="vdt-metric-number">Gẽ gbe</div>
            <div className="vdt-metric-title">Langue Mina prioritaire</div>
            <p className="vdt-metric-desc">
              Langue véhiculaire majeure parlée par des millions de locuteurs au Togo et au Bénin.
            </p>
          </div>
          <div className="vdt-metric-card">
            <div className="vdt-metric-number">100%</div>
            <div className="vdt-metric-title">Projet ouvert &amp; éthique</div>
            <p className="vdt-metric-desc">
              Respect rigoureux du consentement, sans traceur commercial ni captation abusive.
            </p>
          </div>
          <div className="vdt-metric-card">
            <div className="vdt-metric-number">STT &amp; TTS</div>
            <div className="vdt-metric-title">Recherche &amp; Technologies</div>
            <p className="vdt-metric-desc">
              Données destinées à la reconnaissance et à la synthèse de parole pour l'IA.
            </p>
          </div>
          <div className="vdt-metric-card">
            <div className="vdt-metric-number">
              {countMina > 0 ? `${countMina}` : '3 min'}
            </div>
            <div className="vdt-metric-title">
              {countMina > 0 ? 'Phrases en Mina' : 'Participation rapide'}
            </div>
            <p className="vdt-metric-desc">
              Disponibles dès maintenant dans le studio. Chaque prise enrichit directement le corpus.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION C : NOTRE MISSION
          ======================================================== */}
      <section className="vdt-section" id="mission">
        <div className="vdt-section-header">
          <div className="vdt-section-tag">NOTRE MISSION</div>
          <h2 className="vdt-section-title">
            Bâtir les fondations numériques de la langue Mina
          </h2>
          <p className="vdt-section-subtitle">
            Alors que les technologies vocales redéfinissent la façon dont le monde communique,
            la plupart des langues africaines restent exclues des assistants et traducteurs automatiques.
            Gen/Mina s'engage à changer cette réalité à travers trois axes fondamentaux.
          </p>
        </div>

        <div className="vdt-three-pillars-grid">
          <div className="vdt-pillar-card">
            <div className="vdt-pillar-icon-box vdt-icon-lime">
              <Globe size={24} />
            </div>
            <h3 className="vdt-pillar-title">1. Valoriser la langue Mina</h3>
            <p className="vdt-pillar-text">
              La langue Mina (Gẽ gbe) possède une richesse lexicale, tonale et culturelle immense.
              Notre mission est d'assurer sa pérennité et sa visibilité dans l'univers numérique
              en documentant son usage authentique tel qu'il est parlé au quotidien.
            </p>
            <div className="vdt-pillar-highlight">
              Préserver l'héritage linguistique vivant face aux mutations technologiques.
            </div>
          </div>

          <div className="vdt-pillar-card">
            <div className="vdt-pillar-icon-box vdt-icon-dark">
              <Layers size={24} />
            </div>
            <h3 className="vdt-pillar-title">2. Constituer des ressources vocales</h3>
            <p className="vdt-pillar-text">
              L'intelligence artificielle vocale a besoin d'enregistrements propres, variés et labellisés.
              Gen/Mina crée un corpus phonétique structuré, associant phrases écrites avec leurs diacritiques
              et signaux audios de qualité.
            </p>
            <div className="vdt-pillar-highlight">
              Des données de qualité, représentatives de divers accents et tranches d'âge.
            </div>
          </div>

          <div className="vdt-pillar-card">
            <div className="vdt-pillar-icon-box vdt-icon-green">
              <Cpu size={24} />
            </div>
            <h3 className="vdt-pillar-title">3. Soutenir la recherche &amp; l'IA</h3>
            <p className="vdt-pillar-text">
              Les datasets constitués serviront de socle aux chercheurs, universités et développeurs
              pour entraîner des modèles de reconnaissance vocale (STT) et de synthèse vocale (TTS)
              adaptés aux réalités linguistiques locales.
            </p>
            <div className="vdt-pillar-highlight">
              Ouvrir la voie à des outils d'accessibilité vocale utiles à tous les citoyens.
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION D : COMMENT PARTICIPER ?
          ======================================================== */}
      <section className="vdt-section vdt-section-light" id="comment-participer">
        <div className="vdt-section-header">
          <div className="vdt-section-tag">PARCOURS PARTICIPANT</div>
          <h2 className="vdt-section-title">Comment participer à la collecte ?</h2>
          <p className="vdt-section-subtitle">
            Participer ne demande aucune compétence technique particulière. Un simple micro sur votre téléphone
            ou votre ordinateur suffit. Suivez ces 3 étapes simples :
          </p>
        </div>

        <div className="vdt-steps-grid">
          <div className="vdt-step-card">
            <div className="vdt-step-top">
              <span className="vdt-step-number">01</span>
              <span className="vdt-step-badge">Confidentialité</span>
            </div>
            <h3 className="vdt-step-title">Découvrir le projet &amp; consentir</h3>
            <p className="vdt-step-text">
              Aucune inscription par mot de passe n'est exigée. Vous découvrez les termes de la collecte
              et donnez votre accord en un clic. Un <strong>Code de Récupération unique</strong> (ex :{' '}
              <code>MINA-7K9Q-X24V</code>) vous est attribué pour retrouver votre session ou exercer votre
              droit à l'oubli à tout instant.
            </p>
            <div className="vdt-step-detail">
              <ShieldCheck size={16} />
              <span>Zéro donnée intrusive, anonymat total garanti.</span>
            </div>
          </div>

          <div className="vdt-step-card">
            <div className="vdt-step-top">
              <span className="vdt-step-number">02</span>
              <span className="vdt-step-badge">Enregistrement</span>
            </div>
            <h3 className="vdt-step-title">Lire et enregistrer sa voix</h3>
            <p className="vdt-step-text">
              Dans le studio de collecte, des phrases en Mina vous sont proposées une à une.
              Appuyez sur le bouton du micro, lisez la phrase à voix haute de manière naturelle,
              puis arrêtez la prise. Un spectre audio en temps réel vous aide à vérifier le niveau sonore.
            </p>
            <div className="vdt-step-detail">
              <Headphones size={16} />
              <span>Vous pouvez réécouter ou refaire votre prise en un clic.</span>
            </div>
          </div>

          <div className="vdt-step-card">
            <div className="vdt-step-top">
              <span className="vdt-step-number">03</span>
              <span className="vdt-step-badge">Transmission</span>
            </div>
            <h3 className="vdt-step-title">Envoyer ses contributions</h3>
            <p className="vdt-step-text">
              Lorsque l'enregistrement vous convient, cliquez sur « Valider la prise ».
              Votre fichier audio est transmis de façon sécurisée pour être vérifié puis intégré au corpus.
              Vous pouvez enregistrer 2, 5, 10 phrases ou plus selon votre disponibilité.
            </p>
            <div className="vdt-step-detail">
              <CheckCircle2 size={16} />
              <span>Vos contributions enrichissent directement le corpus d'entraînement.</span>
            </div>
          </div>
        </div>

        <div className="vdt-steps-cta-center">
          <button type="button" className="vdt-btn-primary" onClick={onStartCollect}>
            <span>Démarrer dès maintenant</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ========================================================
          SECTION E : POURQUOI VOTRE VOIX COMPTE
          ======================================================== */}
      <section className="vdt-section" id="pourquoi-votre-voix">
        <div className="vdt-section-header">
          <div className="vdt-section-tag">IMPACT &amp; SOUVERAINETÉ</div>
          <h2 className="vdt-section-title">Pourquoi votre voix compte</h2>
          <p className="vdt-section-subtitle">
            Documenter une langue vivante n'est pas seulement un défi technique, c'est un acte de transmission
            et d'autonomie numérique pour les générations futures.
          </p>
        </div>

        <div className="vdt-why-grid">
          <div className="vdt-why-card">
            <div className="vdt-why-icon-bubble">
              <Users size={22} />
            </div>
            <div className="vdt-why-content">
              <h3 className="vdt-why-title">La diversité des timbres et des accents</h3>
              <p className="vdt-why-text">
                Pour qu'une intelligence artificielle comprenne tout le monde, elle doit avoir entendu
                des voix de tous âges, féminines et masculines, des intonations de Lomé, d'Aného,
                de Grand-Popo ou de la diaspora. Chaque accent contribue à la robustesse du modèle.
              </p>
            </div>
          </div>

          <div className="vdt-why-card">
            <div className="vdt-why-icon-bubble">
              <Mic size={22} />
            </div>
            <div className="vdt-why-content">
              <h3 className="vdt-why-title">Préserver la justesse phonétique du Mina</h3>
              <p className="vdt-why-text">
                Le Mina possède des nuances phonologiques uniques (sons labio-vélaires, tons mélodiques).
                Seuls des locuteurs enregistrant leur langue peuvent capturer fidèlement la cadence
                et la justesse qui manquent aux systèmes automatisés actuels.
              </p>
            </div>
          </div>

          <div className="vdt-why-card">
            <div className="vdt-why-icon-bubble">
              <Sparkles size={22} />
            </div>
            <div className="vdt-why-content">
              <h3 className="vdt-why-title">Ouvrir la voie aux futurs outils d'accessibilité</h3>
              <p className="vdt-why-text">
                Un corpus vocal de qualité prépare le terrain pour de futurs services vocaux
                dans la santé, l'inclusion financière, l'éducation ou la transcription de messages
                pour les personnes qui privilégient l'oral.
              </p>
            </div>
          </div>

          <div className="vdt-why-card">
            <div className="vdt-why-icon-bubble">
              <ShieldCheck size={22} />
            </div>
            <div className="vdt-why-content">
              <h3 className="vdt-why-title">Une démarche responsable et transparente</h3>
              <p className="vdt-why-text">
                L'entraînement de modèles vocaux fiables est un travail rigoureux et progressif.
                Gen/Mina s'inscrit dans une démarche scientifique honnête : chaque voix collectée
                aujourd'hui pose une pierre solide pour demain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION F : BANNIÈRE D'APPEL À L'ACTION (CTA BANNER)
          ======================================================== */}
      <section className="vdt-cta-banner-wrapper">
        <div className="vdt-cta-banner">
          <div className="vdt-cta-banner-content">
            <div className="vdt-cta-badge">
              <Sparkles size={14} />
              <span>VOTRE CONTRIBUTION COMPTE</span>
            </div>

            <h2 className="vdt-cta-title">Prêt à faire entendre la langue Mina ?</h2>

            <p className="vdt-cta-text">
              Rejoignez l'initiative Gen/Mina dès aujourd'hui. Prenez quelques minutes pour enregistrer
              des phrases et participer à la valorisation numérique de notre langue.
            </p>

            <div className="vdt-cta-btn-row">
              <button
                type="button"
                id="banner-participate-btn"
                className="vdt-btn-banner-black"
                onClick={onStartCollect}
              >
                <span>{hasConsent ? 'Accéder au Studio' : 'Participer maintenant'}</span>
                <ChevronRight size={18} />
              </button>

              {!hasConsent && (
                <button
                  type="button"
                  className="vdt-btn-banner-ghost"
                  onClick={onOpenConsentModal}
                >
                  <ShieldCheck size={16} />
                  <span>Consulter la charte de consentement</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
