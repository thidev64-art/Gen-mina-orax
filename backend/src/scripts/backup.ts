import fs from 'fs';
import path from 'path';

/**
 * Script de sauvegarde locale des données Gen/Mina
 * Copie de façon horodatée les enregistrements JSON, consentements et phrases personnalisées.
 */
export async function runBackup(): Promise<{ backupDir: string; filesCopied: number }> {
  const dataDir = path.resolve(process.cwd(), 'data');
  const backupBaseDir = path.resolve(process.cwd(), 'data', 'backups');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(backupBaseDir, `backup_${timestamp}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filesToBackup = [
    'recordings.json',
    'consents.json',
    'prompts_custom.json',
    'mina_udhr_corpus.json'
  ];

  let filesCopied = 0;
  for (const filename of filesToBackup) {
    const src = path.join(dataDir, filename);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, filename);
      await fs.promises.copyFile(src, dest);
      filesCopied++;
    }
  }

  // Écriture du manifeste de sauvegarde
  const manifest = {
    createdAt: new Date().toISOString(),
    filesCopied,
    files: filesToBackup.filter((f) => fs.existsSync(path.join(dataDir, f)))
  };
  await fs.promises.writeFile(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log(`[Backup] Sauvegarde réussie dans : ${targetDir} (${filesCopied} fichiers copiés)`);
  return { backupDir: targetDir, filesCopied };
}

// Exécution directe si appelé par CLI
if (process.argv[1] && process.argv[1].endsWith('backup.ts')) {
  runBackup().catch((err) => {
    console.error('[Backup Error]', err);
    process.exit(1);
  });
}
