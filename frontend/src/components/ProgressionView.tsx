import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Mic, Key, BadgeCheck } from 'lucide-react';
import { CATEGORY_LABELS, type Prompt } from '../types';

interface ProgressionViewProps {
  prompts: Prompt[];
  currentIndex: number;
  onSelectPromptIndex: (index: number) => void;
  onBackToStudio: () => void;
  onOpenRecoverModal: () => void;
  sessionTakesCount: number;
  selectedLanguageId: string;
}

export const ProgressionView: React.FC<ProgressionViewProps> = ({
  prompts,
  currentIndex,
  onSelectPromptIndex,
  onBackToStudio,
  onOpenRecoverModal,
  sessionTakesCount,
  selectedLanguageId
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'todo' | 'done'>('all');

  const completedCount = prompts.filter((p) => p.participantStatus?.completed).length;
  const remainingCount = Math.max(0, prompts.length - completedCount);
  const completionPct = prompts.length > 0 ? Math.round((completedCount / prompts.length) * 100) : 0;
  const isMina = selectedLanguageId === 'mina';

  const indexedPrompts = prompts
    .map((p, idx) => ({ prompt: p, originalIndex: idx }))
    .filter(({ prompt }) => {
      const done = !!prompt.participantStatus?.completed;
      if (filterMode === 'todo') return !done;
      if (filterMode === 'done') return done;
      return true;
    });

  return (
    <div className="progression-page">
      {/* En-tête de retour */}
      <div className="progression-top-bar">
        <button type="button" className="vdt-btn-secondary vdt-btn-sm" onClick={onBackToStudio}>
          <ArrowLeft size={15} />
          <span>Retour au Studio</span>
        </button>

        <button type="button" className="vdt-btn-secondary vdt-btn-sm" onClick={onOpenRecoverModal}>
          <Key size={14} />
          <span>Reprendre avec mon code</span>
        </button>
      </div>

      {/* Carte de résumé */}
      <div className="progression-summary-card">
        <div className="progression-header-row">
          <div>
            <span className="vdt-section-tag" style={{ marginBottom: '8px' }}>
              {isMina ? 'CORPUS MINA (GẼ GBE)' : 'CORPUS FRANÇAIS'}
            </span>
            <h1 className="progression-title">Votre état d'avancement</h1>
            <p className="progression-subtitle">
              Suivi en temps réel de vos contributions vocales enregistrées sous votre identifiant anonyme.
            </p>
          </div>
          <div className="progression-pct-pill">{completionPct}%</div>
        </div>

        <div className="studio-progress-bar-bg">
          <div className="studio-progress-bar-fill" style={{ width: `${completionPct}%` }} />
        </div>

        <div className="stats-triplet">
          <div className="stat-cell">
            <span className="stat-number">{completedCount}</span>
            <span className="stat-tag">Phrases traitées</span>
          </div>

          <div className="stat-cell">
            <span className="stat-number">{remainingCount}</span>
            <span className="stat-tag">Phrases restantes</span>
          </div>

          <div className="stat-cell">
            <span className="stat-number">{sessionTakesCount}</span>
            <span className="stat-tag">Prises cette session</span>
          </div>
        </div>
      </div>

      {/* Liste des phrases avec filtres */}
      <div className="progression-list-section">
        <div className="progression-list-header">
          <h2 className="progression-list-title">
            Phrases du corpus ({indexedPrompts.length})
          </h2>

          <div className="progression-filter-tabs" role="tablist">
            <button
              type="button"
              className={`prog-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              Toutes ({prompts.length})
            </button>
            <button
              type="button"
              className={`prog-filter-btn ${filterMode === 'todo' ? 'active' : ''}`}
              onClick={() => setFilterMode('todo')}
            >
              À faire ({remainingCount})
            </button>
            <button
              type="button"
              className={`prog-filter-btn ${filterMode === 'done' ? 'active' : ''}`}
              onClick={() => setFilterMode('done')}
            >
              Enregistrées ({completedCount})
            </button>
          </div>
        </div>

        <div className="prompt-list-scroll">
          {indexedPrompts.length === 0 ? (
            <div className="prompt-list-empty">
              Aucune phrase dans cette catégorie pour le moment.
            </div>
          ) : (
            indexedPrompts.map(({ prompt: p, originalIndex }) => {
              const isCompleted = !!p.participantStatus?.completed;
              const takesCount = p.participantStatus?.takesCount || 0;
              const isActive = originalIndex === currentIndex;

              return (
                <button
                  type="button"
                  key={p.id}
                  className={`prompt-list-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSelectPromptIndex(originalIndex);
                    onBackToStudio();
                  }}
                >
                  <div className="prompt-item-left">
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="vdt-text-vert-profond" />
                    ) : (
                      <Circle size={18} style={{ color: 'var(--border-strong)' }} />
                    )}
                    <span className="prompt-item-index">#{originalIndex + 1}</span>
                  </div>

                  <div className="prompt-list-text">« {p.text} »</div>

                  <div className="prompt-item-right">
                    {p.validatedByNativeSpeaker && (
                      <BadgeCheck
                        size={14}
                        className="vdt-text-vert-profond"
                        aria-label="Phrase certifiée"
                      />
                    )}
                    <span className="prompt-item-cat">
                      {CATEGORY_LABELS[p.category] || p.category}
                    </span>
                    {takesCount > 0 && (
                      <span className="prompt-item-takes">{takesCount} prise(s)</span>
                    )}
                    <span className="prompt-item-mic">
                      <Mic size={14} />
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
