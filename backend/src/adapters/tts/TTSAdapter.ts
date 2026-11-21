import { TTSSynthesisResult } from '../../types/index.js';

export interface TTSAdapter {
  readonly adapterName: string;
  readonly supportedLanguages: string[];

  synthesize(text: string, languageId: string): Promise<TTSSynthesisResult>;
}

export class StubTTSAdapter implements TTSAdapter {
  readonly adapterName = 'Coqui-MMS-TTS-Adapter';
  readonly supportedLanguages = ['fr', 'wo', 'bm', 'yo', 'fon', 'ln', 'sw'];

  async synthesize(text: string, _languageId: string): Promise<TTSSynthesisResult> {
    // Modular adapter signature ready to connect to Coqui/XTTS/Meta MMS
    return {
      audioBuffer: Buffer.from([]),
      mimeType: 'audio/wav',
      adapterName: this.adapterName
    };
  }
}
