import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  RotateCcw,
  Send,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Bookmark,
  Check,
  BadgeCheck,
  Filter,
  PartyPopper,
  ListChecks
} from 'lucide-react';
import { CATEGORY_LABELS, type Language, type Prompt, type RecordingMetadata } from '../types';
import { apiUrl } from '../lib/api';

const MAX_RECORDING_SECONDS = 60;

function detectSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  const testTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav'
  ];
  const found = testTypes.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
  return found || 'audio/webm';
}

interface CollectStudioProps {
  languages: Language[];
  selectedLanguageId: string;
  onSelectLanguage: (langId: string) => void;
  unrecordedOnly: boolean;
  onToggleUnrecordedOnly: () => void;
  prompts: Prompt[];
  currentIndex: number;
  onNextPrompt: () => void;
  onPrevPrompt: () => void;
  onRandomPrompt: () => void;
  onGoToProgression: () => void;
  speakerId: string;
  consentVersion: string;
  onRecordingSaved: (recording: RecordingMetadata) => void;
  onConsentInvalidated: () => void;
}

export const CollectStudio: React.FC<CollectStudioProps> = ({
  languages,
  selectedLanguageId,
  onSelectLanguage,
  unrecordedOnly,
  onToggleUnrecordedOnly,
  prompts,
  currentIndex,
  onNextPrompt,
  onPrevPrompt,
  onRandomPrompt,
  onGoToProgression,
  speakerId,
  consentVersion,
  onRecordingSaved,
  onConsentInvalidated
}) => {
  const currentPrompt = prompts[currentIndex] || null;
  const mediaRecorderAvailable =
    typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  const [supportedMimeType] = useState<string>(() => detectSupportedMimeType());
  const [recorderState, setRecorderState] = useState<
    'idle' | 'recording' | 'recorded' | 'uploading' | 'success' | 'error'
  >('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioTotalDuration, setAudioTotalDuration] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    mediaRecorderAvailable
      ? null
      : "L'API MediaRecorder n'est pas supportée par votre navigateur. Veuillez utiliser un navigateur moderne (Chrome, Safari, Firefox)."
  );
  const [lowVolumeWarning, setLowVolumeWarning] = useState<boolean>(false);
  const [lastSavedTake, setLastSavedTake] = useState<RecordingMetadata | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peakLevelRef = useRef<number>(0);
  const audioUrlRef = useRef<string | null>(null);
  const prevPromptIdRef = useRef<string | undefined>(currentPrompt?.id);

  const cleanupResources = useCallback(() => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const resetTake = useCallback(() => {
    cleanupResources();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioTotalDuration(0);
    setRecorderState('idle');
    setErrorMessage(null);
    setLowVolumeWarning(false);
    setLastSavedTake(null);
  }, [cleanupResources]);

  useEffect(() => {
    return () => {
      cleanupResources();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [cleanupResources]);

  useEffect(() => {
    if (prevPromptIdRef.current !== currentPrompt?.id) {
      prevPromptIdRef.current = currentPrompt?.id;
      const frame = window.requestAnimationFrame(() => {
        resetTake();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [currentPrompt?.id, resetTake]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = window.requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      let framePeak = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > framePeak) framePeak = dataArray[i];
      }
      if (framePeak > peakLevelRef.current) {
        peakLevelRef.current = framePeak;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 40;
      const gap = 4;
      const barWidth = (canvas.width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const binIndex = Math.min(bufferLength - 1, Math.floor((i / barCount) * (bufferLength * 0.75)));
        const value = dataArray[binIndex] / 255;
        const barHeight = Math.max(4, value * canvas.height * 0.92);
        const x = i * (barWidth + gap);
        const y = (canvas.height - barHeight) / 2;

        ctx.fillStyle = value > 0.72 ? '#DC2626' : '#00543F';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 99);
        ctx.fill();
      }
    };

    render();
  }, []);

  const startRecording = useCallback(async () => {
    if (!mediaRecorderAvailable) return;
    try {
      setErrorMessage(null);
      setLowVolumeWarning(false);
      cleanupResources();
      audioChunksRef.current = [];
      peakLevelRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const options: MediaRecorderOptions = {};
      if (supportedMimeType && MediaRecorder.isTypeSupported(supportedMimeType)) {
        options.mimeType = supportedMimeType;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || supportedMimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setLowVolumeWarning(peakLevelRef.current < 14);
        setRecorderState('recorded');
      };

      recorder.start(100);
      setRecorderState('recording');
      setRecordingDuration(0);

      window.requestAnimationFrame(() => drawWaveform());

      const startPerf = performance.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - startPerf) / 1000;
        if (elapsed >= MAX_RECORDING_SECONDS) {
          setRecordingDuration(MAX_RECORDING_SECONDS);
          stopRecording();
        } else {
          setRecordingDuration(elapsed);
        }
      }, 100);
    } catch (err: any) {
      console.error('[Recording Error]', err);
      setErrorMessage(
        `Impossible d'accéder au microphone : ${err?.message || 'Permission refusée'}`
      );
      setRecorderState('error');
    }
  }, [cleanupResources, drawWaveform, mediaRecorderAvailable, stopRecording, supportedMimeType]);

  // Raccourcis clavier pro : Espace (enregistrer/arrêter), Flèches gauche/droite (changer de phrase)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        if (recorderState === 'idle' || recorderState === 'error') {
          e.preventDefault();
          startRecording();
        } else if (recorderState === 'recording') {
          e.preventDefault();
          stopRecording();
        }
      } else if (recorderState === 'idle') {
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          onNextPrompt();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          onPrevPrompt();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recorderState, startRecording, stopRecording, onNextPrompt, onPrevPrompt]);

  const togglePlayAudio = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleValidateAndUpload = async () => {
    if (!audioBlob || !currentPrompt) {
      setErrorMessage('Aucun enregistrement audio à valider.');
      return;
    }

    if (recordingDuration < 0.6) {
      setErrorMessage(
        "L'enregistrement est trop court (moins d'une seconde). Veuillez recommencer."
      );
      return;
    }

    try {
      setRecorderState('uploading');
      setErrorMessage(null);

      const formData = new FormData();
      const ext = audioBlob.type.includes('wav')
        ? 'wav'
        : audioBlob.type.includes('ogg')
        ? 'ogg'
        : audioBlob.type.includes('mp4') || audioBlob.type.includes('aac')
        ? 'm4a'
        : 'webm';

      formData.append(
        'audio',
        audioBlob,
        `take_${Math.round(performance.now())}_${currentPrompt.languageId}_${currentPrompt.id}.${ext}`
      );
      formData.append('promptId', currentPrompt.id);
      formData.append('promptText', currentPrompt.text);
      formData.append('languageId', currentPrompt.languageId);
      formData.append('speakerId', speakerId);
      formData.append('consentGiven', 'true');
      formData.append('consentVersion', consentVersion);
      formData.append('durationSeconds', recordingDuration.toFixed(2));

      const res = await fetch(apiUrl('/api/recordings'), {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.status === 403) {
        onConsentInvalidated();
        throw new Error(data.error || 'Consentement requis pour envoyer votre prise.');
      }
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi au serveur.");
      }

      setLastSavedTake(data.recording);
      setRecorderState('success');
      onRecordingSaved(data.recording);
    } catch (err: any) {
      console.error('[Upload Error]', err);
      setErrorMessage(err.message || "Échec de l'envoi vers le serveur.");
      setRecorderState('recorded');
    }
  };

  const formatTime = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? seconds : 0;
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const publicLanguages = languages
    .filter((l) => l.id === 'mina' || l.id === 'fr')
    .sort((a) => (a.id === 'mina' ? -1 : 1));

  const completedInCorpus = prompts.filter((p) => p.participantStatus?.completed).length;

  // État vide (toutes les phrases faites en mode "À faire uniquement")
  if (!currentPrompt) {
    return (
      <div className="studio-container">
        <div className="studio-toolbar">
          <div className="studio-lang-switch">
            {publicLanguages.map((lang) => (
              <button
                key={lang.id}
                type="button"
                className={`studio-lang-pill ${selectedLanguageId === lang.id ? 'active' : ''}`}
                onClick={() => onSelectLanguage(lang.id)}
              >
                <span>{lang.name}</span>
                {lang.nativeName !== lang.name && (
                  <span className="studio-lang-native">· {lang.nativeName}</span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`studio-filter-pill ${unrecordedOnly ? 'active' : ''}`}
            onClick={onToggleUnrecordedOnly}
          >
            <Filter size={13} />
            <span>À faire uniquement</span>
          </button>
        </div>

        <div className="studio-empty-card">
          <div className="studio-empty-icon">
            <PartyPopper size={28} />
          </div>
          <h2>
            {unrecordedOnly
              ? 'Bravo, vous avez enregistré toutes les phrases !'
              : 'Aucune phrase disponible pour cette langue.'}
          </h2>
          <p>
            {unrecordedOnly
              ? 'Vous pouvez réafficher tout le corpus pour faire de nouvelles prises ou consulter votre progression.'
              : 'Sélectionnez le Mina ou importez un corpus depuis l’administration.'}
          </p>
          <div className="studio-empty-actions">
            {unrecordedOnly && (
              <button type="button" className="vdt-btn-primary vdt-btn-sm" onClick={onToggleUnrecordedOnly}>
                Afficher toutes les phrases
              </button>
            )}
            <button type="button" className="vdt-btn-secondary vdt-btn-sm" onClick={onGoToProgression}>
              Voir ma progression
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = prompts.length > 0 ? ((currentIndex + 1) / prompts.length) * 100 : 0;
  const isMina = selectedLanguageId === 'mina' || currentPrompt.languageId === 'mina';
  const promptStatus = currentPrompt.participantStatus;
  const hasExistingTakes = !!(promptStatus && promptStatus.takesCount > 0);
  const isLastPrompt = currentIndex >= prompts.length - 1;
  const effectiveDuration = audioTotalDuration || recordingDuration || 1;
  const playbackPercent = Math.min(100, Math.round((audioCurrentTime / effectiveDuration) * 100));

  return (
    <div className="studio-container">
      {/* 1. Barre de contrôle compacte sur une ligne */}
      <div className="studio-toolbar">
        <div className="studio-lang-switch" role="radiogroup" aria-label="Langue d'enregistrement">
          {publicLanguages.map((lang) => {
            const active = selectedLanguageId === lang.id;
            const showNative = lang.nativeName.toLowerCase() !== lang.name.toLowerCase();
            return (
              <button
                key={lang.id}
                type="button"
                role="radio"
                aria-checked={active}
                id={`studio-lang-${lang.id}`}
                className={`studio-lang-pill ${active ? 'active' : ''}`}
                disabled={recorderState === 'recording'}
                onClick={() => onSelectLanguage(lang.id)}
              >
                {lang.id === 'mina' && <span className="studio-lang-dot" />}
                <span>{lang.name}</span>
                {showNative && <span className="studio-lang-native">· {lang.nativeName}</span>}
              </button>
            );
          })}
        </div>

        <div className="studio-toolbar-right">
          <button
            type="button"
            id="studio-unrecorded-filter-btn"
            className={`studio-filter-pill ${unrecordedOnly ? 'active' : ''}`}
            disabled={recorderState === 'recording'}
            onClick={onToggleUnrecordedOnly}
            title="Afficher uniquement les phrases pas encore enregistrées"
          >
            <Filter size={13} />
            <span>{unrecordedOnly ? 'À faire uniquement' : 'Toutes'}</span>
          </button>

          <button
            type="button"
            className="studio-list-pill"
            onClick={onGoToProgression}
            title="Voir la liste complète des phrases"
          >
            <ListChecks size={14} />
            <span>
              <strong>{currentIndex + 1}</strong> / {prompts.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. CARTE STUDIO UNIFIÉE (Phrase + Console Audio en un seul bloc épuré) */}
      <div className="studio-unified-card">
        {/* Barre de progression ultra-fine intégrée en haut de la carte */}
        <div
          className="studio-card-progress-track"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={prompts.length}
        >
          <div className="studio-card-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Partie haute : Phrase à lire */}
        <section className="studio-prompt-stage" aria-label="Phrase à enregistrer">
          <div className="phrase-top-row">
            <div className="phrase-badges-left">
              <span className="phrase-category-badge">
                <Bookmark size={12} />
                {CATEGORY_LABELS[currentPrompt.category] || currentPrompt.category}
              </span>

              {currentPrompt.validatedByNativeSpeaker && (
                <span
                  className="phrase-certified-badge"
                  title={currentPrompt.source || 'Phrase issue d’un corpus certifié'}
                >
                  <BadgeCheck size={13} />
                  <span>Certifiée</span>
                </span>
              )}
            </div>

            {hasExistingTakes ? (
              <span className="phrase-status-badge recorded" title="Vous avez déjà enregistré cette phrase">
                <Check size={12} />
                Enregistrée ({promptStatus.takesCount})
              </span>
            ) : (
              <span className="phrase-status-badge">À enregistrer</span>
            )}
          </div>

          <div className="phrase-quote-area">
            <p className="phrase-text-mina" lang={isMina ? 'gej' : 'fr'}>
              « {currentPrompt.text} »
            </p>
            <span className="phrase-instruction">
              Lisez distinctement cette phrase à voix haute d'un ton naturel.
            </span>
          </div>
        </section>

        {/* Partie basse : Console d'enregistrement intégrée */}
        <section className="studio-console-deck" aria-label="Console d'enregistrement">
          {errorMessage && (
            <div className="error-banner" role="alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {lowVolumeWarning && recorderState === 'recorded' && (
            <div className="warning-banner" role="status">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>
                Niveau sonore très faible détecté. Réécoutez votre prise ou rapprochez-vous du micro.
              </span>
            </div>
          )}

          {/* États Prêt / Enregistrement / Erreur */}
          {(recorderState === 'idle' || recorderState === 'recording' || recorderState === 'error') && (
            <div className="studio-deck-idle-rec">
              {/* Spectre temps réel ou statut minimaliste */}
              <div className={`studio-wave-slot ${recorderState === 'recording' ? 'live' : ''}`}>
                {recorderState === 'recording' ? (
                  <>
                    <div className="timer-chip">
                      <span className="timer-rec-dot" />
                      <span>{formatTime(recordingDuration)}</span>
                    </div>
                    <canvas ref={canvasRef} width={320} height={36} className="waveform-canvas" />
                    <span className="studio-max-cap">/ {formatTime(MAX_RECORDING_SECONDS)}</span>
                  </>
                ) : (
                  <div className="studio-ready-indicator">
                    <span className="studio-ready-dot" />
                    <span>Micro prêt</span>
                    {completedInCorpus > 0 && (
                      <span className="studio-ready-sep">
                        · {completedInCorpus} phrase{completedInCorpus > 1 ? 's' : ''} traitée
                        {completedInCorpus > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cluster symétrique : Navigation ← 🔀 [ MIC ] → */}
              <div className="studio-controls-row">
                <div className="studio-side-controls">
                  <button
                    type="button"
                    id="studio-prev-prompt-btn"
                    className="phrase-nav-btn"
                    onClick={onPrevPrompt}
                    disabled={currentIndex === 0 || recorderState === 'recording'}
                    title="Phrase précédente (←)"
                    aria-label="Phrase précédente"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    id="studio-random-prompt-btn"
                    className="phrase-nav-btn"
                    onClick={onRandomPrompt}
                    disabled={prompts.length <= 1 || recorderState === 'recording'}
                    title="Phrase aléatoire"
                    aria-label="Phrase aléatoire"
                  >
                    <Shuffle size={15} />
                  </button>
                </div>

                {/* Bouton central micro avec anneau de précision */}
                <div className="studio-mic-ring">
                  {recorderState === 'recording' ? (
                    <button
                      type="button"
                      id="stop-record-btn"
                      className="btn-mic-80 recording"
                      onClick={stopRecording}
                      title="Terminer l'enregistrement (Espace)"
                      aria-label="Arrêter l'enregistrement"
                    >
                      <Square size={24} fill="#FFFFFF" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="start-record-btn"
                      className="btn-mic-80 idle"
                      onClick={startRecording}
                      disabled={!mediaRecorderAvailable}
                      title="Démarrer l'enregistrement (Espace)"
                      aria-label="Démarrer l'enregistrement"
                    >
                      <Mic size={30} />
                    </button>
                  )}
                </div>

                <div className="studio-side-controls">
                  <button
                    type="button"
                    id="studio-next-prompt-btn"
                    className="phrase-nav-btn"
                    onClick={onNextPrompt}
                    disabled={isLastPrompt || recorderState === 'recording'}
                    title="Phrase suivante (→)"
                    aria-label="Phrase suivante"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="mic-caption">
                {recorderState === 'recording'
                  ? 'Enregistrement en cours — appuyez pour terminer'
                  : 'Appuyez sur le micro pour lire la phrase'}
              </div>
            </div>
          )}

          {/* État Prise capturée : Lecteur sombre moderne + Validation */}
          {recorderState === 'recorded' && audioUrl && (
            <div className="review-panel">
              <div className="audio-preview-dark">
                <button
                  type="button"
                  id="toggle-playback-btn"
                  className="btn-play-lime"
                  onClick={togglePlayAudio}
                  title={isPlaying ? 'Pause' : 'Réécouter votre prise'}
                  aria-label={isPlaying ? 'Pause' : 'Réécouter'}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
                </button>

                <div className="audio-scrub-wrap">
                  <div className="audio-scrub-track">
                    <div className="audio-scrub-fill" style={{ width: `${playbackPercent}%` }} />
                  </div>
                </div>

                <span className="preview-time-dark">
                  {formatTime(audioCurrentTime)} / {formatTime(effectiveDuration)}
                </span>

                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onTimeUpdate={() => {
                    if (audioPlayerRef.current) {
                      setAudioCurrentTime(audioPlayerRef.current.currentTime);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (audioPlayerRef.current && Number.isFinite(audioPlayerRef.current.duration)) {
                      setAudioTotalDuration(audioPlayerRef.current.duration);
                    }
                  }}
                  onEnded={() => {
                    setIsPlaying(false);
                    setAudioCurrentTime(0);
                  }}
                />
              </div>

              <div className="review-buttons-row">
                <button
                  type="button"
                  id="retry-record-btn"
                  className="vdt-btn-secondary"
                  style={{ justifyContent: 'center' }}
                  onClick={resetTake}
                >
                  <RotateCcw size={15} />
                  <span>Recommencer</span>
                </button>

                <button
                  type="button"
                  id="validate-upload-btn"
                  className="vdt-btn-primary"
                  style={{ justifyContent: 'center' }}
                  onClick={handleValidateAndUpload}
                >
                  <Send size={15} />
                  <span>Valider la prise</span>
                </button>
              </div>
            </div>
          )}

          {/* État Upload */}
          {recorderState === 'uploading' && (
            <div className="studio-uploading-state">
              <Loader2 size={28} className="animate-spin" />
              <span>Envoi sécurisé de votre prise...</span>
            </div>
          )}

          {/* État Succès */}
          {recorderState === 'success' && lastSavedTake && (
            <div className="studio-success-stack">
              <div className="success-banner">
                <CheckCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  Prise n° {lastSavedTake.takeNumber} enregistrée avec succès !
                  {isLastPrompt && ' Fin de la série atteinte.'}
                </span>
              </div>

              <div className="review-buttons-row">
                <button
                  type="button"
                  id="record-another-take-btn"
                  className="vdt-btn-secondary"
                  style={{ justifyContent: 'center' }}
                  onClick={resetTake}
                >
                  <RotateCcw size={15} />
                  <span>Refaire une prise</span>
                </button>

                {!isLastPrompt ? (
                  <button
                    type="button"
                    id="next-phrase-success-btn"
                    className="vdt-btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={() => {
                      resetTake();
                      onNextPrompt();
                    }}
                  >
                    <span>Phrase suivante</span>
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    id="finish-corpus-btn"
                    className="vdt-btn-primary"
                    style={{ justifyContent: 'center' }}
                    onClick={onGoToProgression}
                  >
                    <span>Voir ma progression</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Aide discrète raccourcis clavier (desktop uniquement) */}
      <div className="studio-shortcuts-bar" aria-hidden="true">
        <span>
          <kbd>Espace</kbd> Enregistrer / Stop
        </span>
        <span>·</span>
        <span>
          <kbd>←</kbd> <kbd>→</kbd> Changer de phrase
        </span>
      </div>
    </div>
  );
};
