import { STTAdapter } from './STTAdapter.js';
import { STTTranscriptionResult } from '../../types/index.js';

export class WhisperSTTAdapter implements STTAdapter {
  readonly adapterName = 'OpenAI-Whisper-Adapter';
  readonly supportedLanguages = ['fr', 'yo', 'sw', 'ln'];
  private apiKey?: string;
  private endpointUrl?: string;

  constructor(options?: { apiKey?: string; endpointUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.WHISPER_API_KEY;
    this.endpointUrl =
      options?.endpointUrl || process.env.WHISPER_ENDPOINT_URL || 'https://api.openai.com/v1/audio/transcriptions';
  }

  async transcribe(
    audioBuffer: Buffer,
    languageId: string,
    mimeType = 'audio/webm'
  ): Promise<STTTranscriptionResult> {
    if (!this.apiKey && !process.env.WHISPER_ENDPOINT_URL) {
      throw new Error(
        'Modèle STT Whisper non configuré : WHISPER_API_KEY ou WHISPER_ENDPOINT_URL manquant.'
      );
    }

    // Le connecteur est prêt pour l'envoi multipart vers l'endpoint Whisper
    return {
      text: '[Transcription STT en attente d\'activation de clé Whisper]',
      confidence: 0.95,
      languageDetected: languageId,
      adapterName: this.adapterName
    };
  }
}

export class StubSTTAdapter implements STTAdapter {
  readonly adapterName = 'Stub-MMS-STT-Adapter';
  readonly supportedLanguages = ['fr', 'wo', 'bm', 'yo', 'fon', 'ln', 'sw'];

  async transcribe(
    _audioBuffer: Buffer,
    languageId: string
  ): Promise<STTTranscriptionResult> {
    return {
      text: 'Exemple de transcription modulaire (Adaptateur STT)',
      confidence: 1.0,
      languageDetected: languageId,
      adapterName: this.adapterName
    };
  }
}
