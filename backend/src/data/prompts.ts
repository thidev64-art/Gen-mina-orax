import { Prompt } from '../types/index.js';

export const PROMPTS: Prompt[] = [
  // Mina (Gẽ gbe - Togo / Bénin) - Expressions de base indicatives
  // NOTE : Conformément à la consigne, ces phrases ne sont pas présentées comme validées par un locuteur natif.
  // Le corpus étendu doit être importé via l'outil d'import dédié (/api/admin/prompts/import).
  {
    id: 'mina-001',
    languageId: 'mina',
    text: 'Ndi na mi, eŋuti fafa le mia gbɔ a ?',
    category: 'daily_life',
    difficulty: 'easy',
    source: 'Expression usuelle indicative',
    validatedByNativeSpeaker: false
  },
  {
    id: 'mina-002',
    languageId: 'mina',
    text: 'Mia dogo le zã me, mawu na kpe ɖe mia ŋu.',
    category: 'daily_life',
    difficulty: 'easy',
    source: 'Expression usuelle indicative',
    validatedByNativeSpeaker: false
  },
  {
    id: 'mina-003',
    languageId: 'mina',
    text: 'Nu ɖeka ɖeka wotona yia teƒe didi.',
    category: 'cultural',
    difficulty: 'medium',
    source: 'Proverbe traditionnel gbe indicatif',
    validatedByNativeSpeaker: false
  },

  // Français
  {
    id: 'fr-001',
    languageId: 'fr',
    text: 'Bonjour, comment allez-vous aujourd\'hui ?',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'fr-002',
    languageId: 'fr',
    text: 'Le soleil se lève sur la lagune et annonce une journée radieuse.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'fr-003',
    languageId: 'fr',
    text: 'Le train express régional partira à quatorze heures trente précises.',
    category: 'numbers',
    difficulty: 'easy'
  },
  {
    id: 'fr-004',
    languageId: 'fr',
    text: 'L\'intelligence artificielle vocale permet de préserver nos langues ancestrales.',
    category: 'tech',
    difficulty: 'medium'
  },
  {
    id: 'fr-005',
    languageId: 'fr',
    text: 'Au marché Dantokpa, les commerçantes négocient avec bonne humeur et vivacité.',
    category: 'cultural',
    difficulty: 'medium'
  },

  // Wolof (Sénégal)
  {
    id: 'wo-001',
    languageId: 'wo',
    text: 'Nanga def ? Mangi fi rekk, jàmm rekk.',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'wo-002',
    languageId: 'wo',
    text: 'Nit, nit ay garabam, teranga mooy suñu aada.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'wo-003',
    languageId: 'wo',
    text: 'Ndox mi sedda na te neex na lool ci tàngoor bi.',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'wo-004',
    languageId: 'wo',
    text: 'Dinaa dem Ndakaaru ëllëg ci suba teel.',
    category: 'general',
    difficulty: 'medium'
  },

  // Bambara (Mali)
  {
    id: 'bm-001',
    languageId: 'bm',
    text: 'I ni sogoma ! Somɔgɔw bɛ di ?',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'bm-002',
    languageId: 'bm',
    text: 'Mogo kelen tɛ se ka dugu kɛ dugu ye.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'bm-003',
    languageId: 'bm',
    text: 'An ka dɔɔnin dɔɔnin taa ka se an ka ɲɛsinnaw ma.',
    category: 'general',
    difficulty: 'medium'
  },

  // Yoruba (Nigeria / Bénin)
  {
    id: 'yo-001',
    languageId: 'yo',
    text: 'Ẹ n lẹ́ o, báwo ni gbogbo nǹkan ?',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'yo-002',
    languageId: 'yo',
    text: 'Ilé la ti ń kọ́ èṣọ́ ròde, àṣà wa sì dùn púpọ̀.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'yo-003',
    languageId: 'yo',
    text: 'Ọmọdé gbọ́n, àgbà gbọ́n, la fi dá ilẹ̀ Ifẹ̀.',
    category: 'cultural',
    difficulty: 'hard'
  },

  // Fon / Fongbe (Bénin)
  {
    id: 'fon-001',
    languageId: 'fon',
    text: 'A fon dagbe a ? Gbɛ ɔ ɖo dagbe tawun.',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'fon-002',
    languageId: 'fon',
    text: 'Mɛɖé ma nɔ do nu ɖo wě mɛ bɔ é nɔ vɔ́ gbeɖé ǎ.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'fon-003',
    languageId: 'fon',
    text: 'Mi wa mǐ ni jla gbè mítɔn lɛ do nú vǐ mítɔn lɛ.',
    category: 'tech',
    difficulty: 'medium'
  },

  // Lingala (Congo)
  {
    id: 'ln-001',
    languageId: 'ln',
    text: 'Mbote na bino nyonso, sango nini lelo ?',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'ln-002',
    languageId: 'ln',
    text: 'Ebale ya Congo ezali monene mingi mpe kitoko.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'ln-003',
    languageId: 'ln',
    text: 'Mokili mobimba ezali kokende liboso na mayele ya sika.',
    category: 'tech',
    difficulty: 'medium'
  },

  // Swahili (Afrique de l'Est)
  {
    id: 'sw-001',
    languageId: 'sw',
    text: 'Habari za asubuhi, karibu sana kwenye jukwaa hili.',
    category: 'daily_life',
    difficulty: 'easy'
  },
  {
    id: 'sw-002',
    languageId: 'sw',
    text: 'Umoja ni nguvu, utengano ni udhaifu.',
    category: 'cultural',
    difficulty: 'medium'
  },
  {
    id: 'sw-003',
    languageId: 'sw',
    text: 'Teknolojia ya sauti inasaidia kuunganisha bara la Afrika.',
    category: 'tech',
    difficulty: 'medium'
  }
];
