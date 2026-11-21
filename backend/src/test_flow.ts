import fs from 'fs';
import path from 'path';

// Génère un fichier WAV PCM 16-bit mono 8000Hz valide de 1 seconde (bip audio réel 440 Hz)
function generateTestWav(): Buffer {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const subChunk2Size = numSamples * numChannels * (bitsPerSample / 8);
  const chunkSize = 36 + subChunk2Size;

  const buffer = Buffer.alloc(44 + subChunk2Size);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(subChunk2Size, 40);

  // Onde sinusoïdale 440 Hz (Note La)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 32767 * 0.5;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 GEN/MINA — SUITE DE TESTS COMPLÈTE : SÉCURITÉ, FIABILITÉ & MINA');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000';
  let adminCookie = '';

  // -------------------------------------------------------------------------
  // TEST 1 : Vérification de la priorité au Mina dans les langues
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 1] Vérification du référentiel des langues...');
  const langRes = await fetch(`${BASE_URL}/api/languages`);
  const languages = (await langRes.json()) as any[];
  if (!langRes.ok || languages.length === 0) {
    throw new Error('Échec de récupération des langues.');
  }

  const firstLang = languages[0];
  console.log(`  Première langue retournée : ${firstLang.id} (${firstLang.name} - ${firstLang.nativeName})`);
  if (firstLang.id !== 'mina') {
    throw new Error(`Le Mina devrait être la première langue, mais ${firstLang.id} a été retourné.`);
  }
  console.log('  ✅ Priorité Mina validée : Mina est à l\'index 0.\n');

  // -------------------------------------------------------------------------
  // TEST 2 : Sécurité des routes d'administration (Rejet 401 sans session)
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 2] Vérification de la protection des routes administration sans authentification...');

  const unauthListRes = await fetch(`${BASE_URL}/api/admin/recordings`);
  console.log(`  GET /api/admin/recordings sans auth -> Code HTTP : ${unauthListRes.status} (Attendu: 401)`);
  if (unauthListRes.status !== 401) {
    throw new Error(`La route devrait rejeter avec 401, mais a répondu ${unauthListRes.status}`);
  }

  const unauthExportRes = await fetch(`${BASE_URL}/api/admin/export?format=json`);
  console.log(`  GET /api/admin/export sans auth -> Code HTTP : ${unauthExportRes.status} (Attendu: 401)`);
  if (unauthExportRes.status !== 401) {
    throw new Error(`L'export devrait rejeter avec 401, mais a répondu ${unauthExportRes.status}`);
  }

  const unauthDeleteRes = await fetch(`${BASE_URL}/api/recordings/fake-id-test`, { method: 'DELETE' });
  console.log(`  DELETE /api/recordings/:id sans auth -> Code HTTP : ${unauthDeleteRes.status} (Attendu: 401)`);
  if (unauthDeleteRes.status !== 401) {
    throw new Error(`La suppression devrait rejeter avec 401, mais a répondu ${unauthDeleteRes.status}`);
  }

  const unauthImportRes = await fetch(`${BASE_URL}/api/admin/prompts/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([])
  });
  console.log(`  POST /api/admin/prompts/import sans auth -> Code HTTP : ${unauthImportRes.status} (Attendu: 401)`);
  if (unauthImportRes.status !== 401) {
    throw new Error(`L'import de corpus devrait rejeter avec 401, mais a répondu ${unauthImportRes.status}`);
  }
  console.log('  ✅ Toutes les routes d\'administration sont strictement protégées (HTTP 401).\n');

  // -------------------------------------------------------------------------
  // TEST 3 : Authentification administrateur & Gestion des sessions
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 3] Test d\'authentification administrateur (échec puis succès)...');

  // Échec avec mauvais mot de passe
  const badLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'MauvaisMotDePasse123!' })
  });
  const badLoginData = (await badLoginRes.json()) as any;
  console.log(`  Tentative avec mot de passe erroné -> Code HTTP : ${badLoginRes.status} (Attendu: 401)`);
  console.log(`  Message reçu : "${badLoginData.error}"`);
  if (badLoginRes.status !== 401) {
    throw new Error('Le login erroné aurait dû être rejeté avec 401.');
  }

  // Succès avec les identifiants configurés
  const goodLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'GenMina2026!Securite' })
  });
  if (!goodLoginRes.ok) {
    throw new Error('La connexion avec les bons identifiants a échoué.');
  }

  // Extraction du cookie de session
  const setCookieHeader = goodLoginRes.headers.get('set-cookie');
  if (setCookieHeader) {
    adminCookie = setCookieHeader.split(';')[0];
    console.log(`  Cookie de session reçu : ${adminCookie.slice(0, 30)}...`);
  } else {
    throw new Error('Aucun cookie de session n\'a été émis par le serveur.');
  }

  // Vérification de la session active sur /api/admin/me
  const meRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Cookie: adminCookie }
  });
  const meData = (await meRes.json()) as any;
  console.log(`  GET /api/admin/me avec cookie -> Authentifié : ${meData.authenticated}, Utilisateur : ${meData.username}`);
  if (!meData.authenticated) {
    throw new Error('La session active n\'a pas été reconnue par /api/admin/me.');
  }
  console.log('  ✅ Authentification administrateur validée.\n');

  // -------------------------------------------------------------------------
  // TEST 4 : Contrôle strict du consentement côté serveur & Collecte audio Mina
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 4] Contrôle d\'autorisation du consentement & Collecte vocale réelle en Mina...');
  // Purge préventive pour garantir un état propre si un test précédent a été interrompu
  await fetch(`${BASE_URL}/api/consent/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speakerId: 'speaker_mina_test_001' })
  });

  const wavBuffer = generateTestWav();

  // Tentative d'enregistrement sans consentement serveur préalable (Doit échouer avec HTTP 403)
  const unconsentedForm = new FormData();
  unconsentedForm.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'take_unconsented.wav');
  unconsentedForm.append('promptId', 'mina-001');
  unconsentedForm.append('promptText', 'Ndi na mi, eŋuti fafa le mia gbɔ a ?');
  unconsentedForm.append('languageId', 'mina');
  unconsentedForm.append('speakerId', 'speaker_mina_test_001');
  unconsentedForm.append('consentGiven', 'true');
  unconsentedForm.append('consentVersion', 'v1.0-2026-10');

  const unconsentedRes = await fetch(`${BASE_URL}/api/recordings`, { method: 'POST', body: unconsentedForm });
  const unconsentedData = (await unconsentedRes.json()) as any;
  console.log(`  Tentative d'enregistrement sans consentement serveur -> Code HTTP : ${unconsentedRes.status} (Attendu: 403)`);
  console.log(`  Message reçu : "${unconsentedData.error}"`);
  if (unconsentedRes.status !== 403) {
    throw new Error('L\'enregistrement aurait dû être rejeté avec 403 en l\'absence de consentement serveur.');
  }
  console.log('  ✅ Rejet côté serveur validé pour participant sans consentement actif.\n');

  // Enregistrement formel du consentement et génération du code de récupération
  console.log('  Enregistrement du consentement autonome pour speaker_mina_test_001...');
  const consentRegRes = await fetch(`${BASE_URL}/api/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      speakerId: 'speaker_mina_test_001',
      consentVersion: 'v1.0-2026-10'
    })
  });
  const consentRegData = (await consentRegRes.json()) as any;
  const userRecoveryCode = consentRegData.recoveryCode;
  console.log(`  POST /api/consent -> Succès : ${consentRegData.success}, Code délivré : ${userRecoveryCode}`);
  if (!userRecoveryCode || !userRecoveryCode.startsWith('MINA-')) {
    throw new Error('Le code de récupération généré est invalide ou absent.');
  }

  // Prise 1 pour le Mina
  const formTake1 = new FormData();
  formTake1.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'take_mina_1.wav');
  formTake1.append('promptId', 'mina-001');
  formTake1.append('promptText', 'Ndi na mi, eŋuti fafa le mia gbɔ a ?');
  formTake1.append('languageId', 'mina');
  formTake1.append('speakerId', 'speaker_mina_test_001');
  formTake1.append('consentGiven', 'true');
  formTake1.append('consentVersion', 'v1.0-2026-10');
  formTake1.append('durationSeconds', '1.0');

  const take1Res = await fetch(`${BASE_URL}/api/recordings`, { method: 'POST', body: formTake1 });
  const take1Data = (await take1Res.json()) as any;
  if (!take1Res.ok) {
    throw new Error(`Échec upload prise 1 : ${JSON.stringify(take1Data)}`);
  }
  const rec1 = take1Data.recording;
  console.log(`  Prise 1 Mina enregistrée -> ID : ${rec1.id}, Prise n° : ${rec1.takeNumber}, Chemin : ${rec1.audioStorageKey}`);
  if (rec1.takeNumber !== 1 || !rec1.audioStorageKey.startsWith('mina/mina-001/take_1_')) {
    throw new Error('La prise 1 Mina n\'a pas reçu les attributs attendus.');
  }

  // Prise 2 pour la même phrase et même locuteur (Doit s'incrémenter à 2 SANS écraser la prise 1)
  const formTake2 = new FormData();
  formTake2.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'take_mina_2.wav');
  formTake2.append('promptId', 'mina-001');
  formTake2.append('promptText', 'Ndi na mi, eŋuti fafa le mia gbɔ a ?');
  formTake2.append('languageId', 'mina');
  formTake2.append('speakerId', 'speaker_mina_test_001');
  formTake2.append('consentGiven', 'true');
  formTake2.append('consentVersion', 'v1.0-2026-10');
  formTake2.append('durationSeconds', '1.0');

  const take2Res = await fetch(`${BASE_URL}/api/recordings`, { method: 'POST', body: formTake2 });
  const take2Data = (await take2Res.json()) as any;
  if (!take2Res.ok) {
    throw new Error(`Échec upload prise 2 : ${JSON.stringify(take2Data)}`);
  }
  const rec2 = take2Data.recording;
  console.log(`  Prise 2 Mina enregistrée -> ID : ${rec2.id}, Prise n° : ${rec2.takeNumber}, Chemin : ${rec2.audioStorageKey}`);
  if (rec2.takeNumber !== 2 || rec2.id === rec1.id) {
    throw new Error('La prise 2 aurait dû être incrémentée à 2 avec un ID distinct.');
  }

  // Vérification de la persistance réelle sur le disque
  const expectedPath1 = path.resolve(process.cwd(), 'data', 'uploads', ...rec1.audioStorageKey.split('/'));
  const expectedPath2 = path.resolve(process.cwd(), 'data', 'uploads', ...rec2.audioStorageKey.split('/'));
  if (!fs.existsSync(expectedPath1) || !fs.existsSync(expectedPath2)) {
    throw new Error('Les fichiers physiques audio n\'ont pas été trouvés sur le disque.');
  }
  console.log('  Vérification disque : les 2 fichiers physiques existent séparément.');

  // Test de streaming audio
  const streamRes = await fetch(`${BASE_URL}${rec1.audioUrl}`);
  console.log(`  Lecture streaming audio -> Code HTTP : ${streamRes.status}, Content-Type : ${streamRes.headers.get('content-type')}`);
  if (streamRes.status !== 200) {
    throw new Error('Le streaming audio a échoué.');
  }
  console.log('  ✅ Collecte vocale, incrémentation et streaming validés.\n');

  // -------------------------------------------------------------------------
  // TEST 5 : Modération des enregistrements (Validation et Rejet avec session)
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 5] Modération avec session administrateur authentifiée...');

  // Liste des enregistrements avec cookie
  const authListRes = await fetch(`${BASE_URL}/api/admin/recordings?languageId=mina`, {
    headers: { Cookie: adminCookie }
  });
  const authListData = (await authListRes.json()) as any;
  console.log(`  Nombre de prises Mina listées pour modération : ${authListData.recordings?.length}`);

  // Validation de la prise 1
  const validateRes = await fetch(`${BASE_URL}/api/admin/recordings/${rec1.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'validated' })
  });
  const validateData = (await validateRes.json()) as any;
  console.log(`  Prise 1 validée -> Statut : ${validateData.recording.status}, Modérateur : ${validateData.recording.reviewedBy}`);
  if (validateData.recording.status !== 'validated') {
    throw new Error('La prise 1 n\'a pas pu être validée.');
  }

  // Rejet de la prise 2 avec motif
  const rejectRes = await fetch(`${BASE_URL}/api/admin/recordings/${rec2.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ status: 'rejected', rejectionReason: 'Hésitation ou bafouillage' })
  });
  const rejectData = (await rejectRes.json()) as any;
  console.log(`  Prise 2 rejetée -> Statut : ${rejectData.recording.status}, Motif : ${rejectData.recording.rejectionReason}`);
  if (rejectData.recording.status !== 'rejected') {
    throw new Error('La prise 2 n\'a pas pu être rejetée.');
  }
  console.log('  ✅ Modération (validation et rejet avec motif) validée.\n');

  // -------------------------------------------------------------------------
  // TEST 6 : Export des données validées (JSON et CSV)
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 6] Export des données validées...');

  const exportJsonRes = await fetch(`${BASE_URL}/api/admin/export?format=json`, {
    headers: { Cookie: adminCookie }
  });
  const exportJsonData = (await exportJsonRes.json()) as any;
  console.log(`  Export JSON -> Prises validées exportées : ${exportJsonData.recordings?.length}`);
  const hasOnlyValidated = exportJsonData.recordings.every((r: any) => r.status === 'validated');
  if (!hasOnlyValidated || exportJsonData.recordings.length === 0) {
    throw new Error('L\'export JSON doit contenir uniquement les prises au statut "validated".');
  }

  const exportCsvRes = await fetch(`${BASE_URL}/api/admin/export?format=csv`, {
    headers: { Cookie: adminCookie }
  });
  const csvText = await exportCsvRes.text();
  console.log(`  Export CSV -> Longueur : ${csvText.length} caractères, Lignes : ${csvText.split('\n').length}`);
  if (!csvText.includes('audioStorageKey') || !csvText.includes('mina')) {
    throw new Error('Le CSV généré est invalide ou ne contient pas les prises Mina.');
  }
  console.log('  ✅ Exportations JSON et CSV conformes et vérifiées.\n');

  // -------------------------------------------------------------------------
  // TEST 7 : Import de phrases de corpus Mina certifiées
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 7] Import d\'un lot de phrases certifiées en Mina (/api/admin/prompts/import)...');

  const newMinaPhrases = [
    {
      id: 'mina-verified-101',
      languageId: 'mina',
      text: 'Mina nyɔnuwo kple ŋutsuwo le dɔ wam kple dzidzɔ.',
      category: 'cultural',
      difficulty: 'medium',
      source: 'Corpus Linguistique Lomé 2026',
      validatedByNativeSpeaker: true
    },
    {
      id: 'mina-verified-102',
      languageId: 'mina',
      text: 'Agbe la le dɔm na mí be míawɔ nu nyui.',
      category: 'general',
      difficulty: 'easy',
      source: 'Corpus Linguistique Lomé 2026',
      validatedByNativeSpeaker: true
    }
  ];

  const importRes = await fetch(`${BASE_URL}/api/admin/prompts/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(newMinaPhrases)
  });
  const importData = (await importRes.json()) as any;
  console.log(`  Résultat import : ${importData.message} (Total importé : ${importData.importedCount})`);

  // Vérification que les nouvelles phrases apparaissent dans /api/prompts?languageId=mina
  const updatedPromptsRes = await fetch(`${BASE_URL}/api/prompts?languageId=mina`);
  const updatedPrompts = (await updatedPromptsRes.json()) as any[];
  const foundNew = updatedPrompts.some((p: any) => p.id === 'mina-verified-101');
  console.log(`  Vérification disponibilité : phrase 'mina-verified-101' présente : ${foundNew}`);
  if (!foundNew) {
    throw new Error('Les phrases importées ne sont pas restituées par /api/prompts.');
  }
  console.log('  ✅ Import dynamique de corpus validé sans redémarrage.\n');

  // -------------------------------------------------------------------------
  // TEST 7B : Sécurité du registre persistant, hachage SHA-256 & Protection force brute
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 7B] Audit de sécurité du consentement : hachage SHA-256 et limitation de force brute...');
  
  // 1. Vérification que le fichier disque data/consents.json NE CONTIENT AUCUN code en clair
  const consentsDiskPath = path.resolve(process.cwd(), 'data', 'consents.json');
  const consentsDiskContent = await fs.promises.readFile(consentsDiskPath, 'utf-8');
  const consentsDiskArray = JSON.parse(consentsDiskContent) as any[];
  const storedUserRecord = consentsDiskArray.find((c: any) => c.speakerId === 'speaker_mina_test_001');
  
  console.log(`  Vérification disque consents.json : Entrée trouvée = ${!!storedUserRecord}`);
  console.log(`  Champ recoveryCodeHash présent (64 hex) : ${storedUserRecord?.recoveryCodeHash?.length === 64}`);
  console.log(`  Champ recoveryCode en clair absent du disque : ${storedUserRecord?.recoveryCode === undefined}`);
  if (!storedUserRecord?.recoveryCodeHash || storedUserRecord.recoveryCodeHash.length !== 64) {
    throw new Error('Le code de récupération aurait dû être persisté sous forme d\'empreinte SHA-256 de 64 caractères.');
  }
  if (storedUserRecord.recoveryCode !== undefined) {
    throw new Error('Alerte sécurité : le code de récupération est stocké en clair sur le disque !');
  }

  // 2. Vérification que l'API publique GET /api/consent/:id ne fuite aucun hash ni code
  const publicConsentRes = await fetch(`${BASE_URL}/api/consent/speaker_mina_test_001`);
  const publicConsentData = (await publicConsentRes.json()) as any;
  console.log(`  Vérification fuite API GET /api/consent/:id -> recoveryCodeHash exposé : ${!!publicConsentData.recoveryCodeHash}`);
  if (publicConsentData.recoveryCodeHash || publicConsentData.recoveryCode) {
    throw new Error('Alerte sécurité : l\'API GET /api/consent/:id fuite des informations cryptographiques sensibles.');
  }

  // 3. Test de protection contre la force brute (Rate Limiting sur /api/consent/claim)
  console.log('  Test de protection anti-force brute (5 échecs consécutifs puis blocage HTTP 429)...');
  for (let attempt = 1; attempt <= 5; attempt++) {
    const badClaimRes = await fetch(`${BASE_URL}/api/consent/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryCode: `MINA-BAD0-000${attempt}` })
    });
    if (badClaimRes.status !== 404) {
      throw new Error(`La tentative erronée n°${attempt} aurait dû retourner 404, reçu : ${badClaimRes.status}`);
    }
  }
  // La 6ème tentative doit être immédiatement bloquée avec HTTP 429 (Too Many Requests)
  const blockedClaimRes = await fetch(`${BASE_URL}/api/consent/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: 'MINA-BAD0-0006' })
  });
  console.log(`  6ème tentative de code erroné -> Code HTTP : ${blockedClaimRes.status} (Attendu: 429 Too Many Requests)`);
  if (blockedClaimRes.status !== 429) {
    throw new Error(`La force brute aurait dû être bloquée avec HTTP 429, reçu ${blockedClaimRes.status}`);
  }
  console.log('  ✅ Protection anti-force brute sur le code de récupération validée (HTTP 429).\n');

  // 4. Déblocage contrôlé par l'administrateur pour poursuivre la suite de tests
  const unblockRes = await fetch(`${BASE_URL}/api/admin/security/reset-recovery-limits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie }
  });
  if (!unblockRes.ok) {
    throw new Error('Échec du déblocage administrateur des limites de récupération.');
  }

  // 5. Test de rétablissement de session légitime via code de récupération valide (/api/consent/claim)
  const validClaimRes = await fetch(`${BASE_URL}/api/consent/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: userRecoveryCode })
  });
  const validClaimData = (await validClaimRes.json()) as any;
  console.log(`  POST /api/consent/claim avec code valide -> Code HTTP : ${validClaimRes.status}, SpeakerId restitué : ${validClaimData.speakerId}`);
  if (!validClaimRes.ok || validClaimData.speakerId !== 'speaker_mina_test_001') {
    throw new Error('Le rétablissement de profil par code de récupération valide a échoué.');
  }
  console.log('  ✅ Rétablissement sécurisé de session via code de récupération validé.\n');

  // -------------------------------------------------------------------------
  // TEST 7C : Import du corpus complet certifié Mina OHCHR UDHR
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 7C] Import du corpus certifié Mina OHCHR UDHR & Proverbes (35 phrases)...');
  const udhrFilePath = path.resolve(process.cwd(), 'data', 'mina_udhr_corpus.json');
  const udhrPrompts = JSON.parse(await fs.promises.readFile(udhrFilePath, 'utf-8'));

  const importUdhrRes = await fetch(`${BASE_URL}/api/admin/prompts/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify(udhrPrompts)
  });
  const importUdhrData = (await importUdhrRes.json()) as any;
  console.log(`  Import UDHR -> Importées : ${importUdhrData.importedCount}, Total custom : ${importUdhrData.totalCustomCount}`);
  if (!importUdhrData.success || importUdhrData.importedCount < 35) {
    throw new Error('Échec de l\'import du corpus complet Mina UDHR.');
  }

  // Vérification de la présence de caractères spéciaux Mina normalisés (ɖ, ɛ, ɔ, ŋ)
  const allMinaPromptsRes = await fetch(`${BASE_URL}/api/prompts?languageId=mina`);
  const allMinaPrompts = (await allMinaPromptsRes.json()) as any[];
  const sampleArticle1 = allMinaPrompts.find((p: any) => p.id === 'mina-udhr-001');
  console.log(`  Vérification de l'Article 1 : "${sampleArticle1?.text}"`);
  if (!sampleArticle1 || !sampleArticle1.text.includes('ɖ') || !sampleArticle1.text.includes('ɔ')) {
    throw new Error('Les caractères diacritiques du Mina n\'ont pas été préservés.');
  }
  console.log('  ✅ Préservation stricte de l\'orthographe et diacritiques Mina validée.\n');

  // -------------------------------------------------------------------------
  // TEST 7D : Filtrage des phrases non encore enregistrées (unrecordedOnly)
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 7D] Filtrage des phrases pour un locuteur (unrecordedOnly=true)...');
  const unrecordedRes = await fetch(
    `${BASE_URL}/api/prompts?languageId=mina&speakerId=speaker_mina_test_001&unrecordedOnly=true`
  );
  const unrecordedPrompts = (await unrecordedRes.json()) as any[];
  const containsRecorded = unrecordedPrompts.some((p: any) => p.id === 'mina-001');
  console.log(`  Total phrases Mina : ${allMinaPrompts.length}, Non enregistrées : ${unrecordedPrompts.length}`);
  console.log(`  La phrase déjà enregistrée mina-001 est-elle exclue ? ${!containsRecorded}`);
  if (containsRecorded) {
    throw new Error('La phrase déjà enregistrée aurait dû être exclue par unrecordedOnly.');
  }
  console.log('  ✅ Filtrage des phrases non enregistrées validé.\n');

  // -------------------------------------------------------------------------
  // TEST 8 : Révocation du consentement via Code de Récupération & Purge intégrale
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 8] Révocation par Code de Récupération et purge complète des données...');
  const revokeRes = await fetch(`${BASE_URL}/api/consent/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: userRecoveryCode })
  });
  const revokeData = (await revokeRes.json()) as any;
  console.log(`  Révocation via recoveryCode '${userRecoveryCode}' -> Succès : ${revokeData.success}`);
  console.log(`  Message reçu : "${revokeData.message}"`);
  if (!revokeData.success) {
    throw new Error('Échec de la révocation par code de récupération.');
  }

  // Vérification que les fichiers audio physiques ont été purgés du disque
  const file1StillExists = fs.existsSync(expectedPath1);
  const file2StillExists = fs.existsSync(expectedPath2);
  console.log(`  Vérification purge fichiers physiques : Prise 1 conservée = ${file1StillExists}, Prise 2 conservée = ${file2StillExists}`);
  if (file1StillExists || file2StillExists) {
    throw new Error('Les fichiers physiques audio auraient dû être supprimés lors de la révocation.');
  }

  // Vérification que les métadonnées ont été purgées
  const checkPurgeRes = await fetch(`${BASE_URL}/api/admin/recordings?speakerId=speaker_mina_test_001`, {
    headers: { Cookie: adminCookie }
  });
  const checkPurgeData = (await checkPurgeRes.json()) as any;
  console.log(`  Nombre d'enregistrements restants pour ce locuteur : ${checkPurgeData.recordings?.length}`);
  if (checkPurgeData.recordings?.length !== 0) {
    throw new Error('Des métadonnées subsistent après la révocation de consentement.');
  }

  // Vérification que le consentement a également été purgé dans ConsentStore
  const checkConsentPurgeRes = await fetch(`${BASE_URL}/api/consent/speaker_mina_test_001`);
  const checkConsentPurgeData = (await checkConsentPurgeRes.json()) as any;
  console.log(`  Vérification purge consentement serveur : consentGiven = ${checkConsentPurgeData.consentGiven}`);
  if (checkConsentPurgeData.consentGiven) {
    throw new Error('Le consentement n\'a pas été purgé dans ConsentStore.');
  }

  // Vérification qu'une nouvelle tentative d'enregistrement pour ce speaker est bloquée (HTTP 403)
  const postRevokeUploadRes = await fetch(`${BASE_URL}/api/recordings`, { method: 'POST', body: formTake1 });
  console.log(`  Tentative d'enregistrement post-révocation -> Code HTTP : ${postRevokeUploadRes.status} (Attendu: 403)`);
  if (postRevokeUploadRes.status !== 403) {
    throw new Error('L\'enregistrement après révocation aurait dû être rejeté avec 403 Forbidden.');
  }
  console.log('  ✅ Procédure de révocation par code de récupération et purge intégrale validées sans résidu.\n');

  // -------------------------------------------------------------------------
  // TEST 9 : Déconnexion administrateur
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 9] Déconnexion administrateur...');
  const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
    method: 'POST',
    headers: { Cookie: adminCookie }
  });
  console.log(`  POST /api/admin/logout -> Code HTTP : ${logoutRes.status}`);

  const postLogoutMeRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Cookie: adminCookie }
  });
  const postLogoutMeData = (await postLogoutMeRes.json()) as any;
  console.log(`  GET /api/admin/me après déconnexion -> Authentifié : ${postLogoutMeData.authenticated}`);
  if (postLogoutMeData.authenticated) {
    throw new Error('La session n\'aurait plus dû être active après déconnexion.');
  }
  console.log('  ✅ Déconnexion et invalidation de session validées.\n');

  console.log('================================================================');
  console.log('🎉 TOUS LES TESTS DE SÉCURITÉ, FIABILITÉ ET DU MINA ONT RÉUSSI !');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Échec du test :', err);
  process.exit(1);
});
