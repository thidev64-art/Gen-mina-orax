import { STTTranscriptionResult } from '../../types/index.js';

export interface STTAdapter {
  readonly adapterName: string;
  readonly supportedLanguages: string[];

  transcribe(
    audioBuffer: Buffer,
    languageId: string,
    mimeType?: string
  ): Promise<STTTranscriptionResult>;
}
