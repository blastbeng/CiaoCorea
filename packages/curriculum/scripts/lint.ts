/**
 * Il controllo delle particelle su tutto il coreano che l'app mostra.
 *
 * Le particelle che cambiano forma (이/가, 은/는, 을/를, 과/와, 으로/로) sono
 * l'errore che un corso scrive più facilmente senza accorgersene: una parola
 * cambiata, un nome proprio nuovo, e la frase suona sbagliata a chiunque sia
 * coreano. Questo controllo le cerca ovunque, nei dati e nelle pagine.
 *
 * Giudica solo quello che la lookup del vocabolario riconosce: una forma che
 * non è nel vocabolario non è giudicata, perché «읽는» è una desinenza di verbo
 * e non una particella, e marcharla come errore sarebbe peggio che non dire
 * niente.
 *
 *   npm run content:lint
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { particleIssues, type ParticleIssue } from '@ciaocorea/engine';
import { getVocabulary } from '../src/index';

const root = fileURLToPath(new URL('../../..', import.meta.url));

/** Cartelle i cui file di testo o di dati contengono coreano mostrato all'utente. */
const WATCHED = ['packages/curriculum/data', 'apps/web/src'];

/**
 * Le forme sbagliate che stanno nel corso di proposito, e perché.
 *
 * Negli esercizi a scelta le opzioni false sono la lezione: «물를» è lì perché
 * è l'errore che si fa con la ㄹ finale di 물. Qui l'errore non è nostro, quindi
 * il controllo deve stare zitto; se una di queste forme sparisce dai dati, il
 * controllo non se ne accorge — è il prezzo di una lista scritta a mano.
 */
const INTENTIONAL: Record<string, string> = {
  물를: "distrattore di una scelta multipla: è l'errore con la ㄹ finale di 물",
};

async function filesIn(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await filesIn(path)));
    } else if (/\.(json|ts|tsx|css|html)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

async function main(): Promise<void> {
  const vocabulary = getVocabulary();
  const problems: { file: string; line: number; issue: ParticleIssue }[] = [];

  for (const file of (await filesIn(WATCHED[0])).concat(await filesIn(WATCHED[1]))) {
    const text = await readFile(join(root, file), 'utf8');
    for (const issue of particleIssues(vocabulary, text)) {
      if (INTENTIONAL[issue.token]) continue;
      // La riga dove la parola compare la prima volta, per poterla aprire.
      const index = text.indexOf(issue.token);
      problems.push({ file, line: index >= 0 ? lineOf(text, index) : 1, issue });
    }
  }

  if (problems.length === 0) {
    console.log('Particelle: nessun problema.');
    return;
  }

  // Una riga per parola sbagliata, con la forma giusta: è ciò che va corretto.
  const seen = new Set<string>();
  for (const problem of problems) {
    const key = `${problem.issue.token}\\u0000${problem.issue.expected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(
      `${problem.file}:${problem.line}  ${problem.issue.token} → ${problem.issue.expected}` +
        `  (base ${problem.issue.base}, finisce in ${problem.issue.baseEnds === 'consonant' ? 'consonante' : 'vocale'})`,
    );
  }
  console.log(`\nParticelle: ${seen.size} forme da correggere in ${problems.length} punti.`);
  process.exit(1);
}

await main();
