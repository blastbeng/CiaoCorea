import { readFileSync } from 'node:fs';

import { pronunciationRomanize, romanizationMatches } from '@ciaocorea/engine';

import {
  courseLessons,
  getCourses,
  getDialogues,
  getVocabulary,
  getWritingPrompts,
} from '../src/index';

/** La romanizzazione della pronuncia standard, verificata parola per parola. */
const ROMANIZATION_REFERENCE: Record<string, string> = JSON.parse(
  readFileSync(new URL('../data/reference/romanization.json', import.meta.url), 'utf-8'),
).words;

/** Come `foldRomanization` del motore, senza importarlo: qui si confronta solo. */
function foldRoman(value: string): string {
  return value.toLowerCase().replace(/['’]/g, '').replace(/[-\s]+/g, '');
}

/**
 * La romanizzazione è l'unica cosa che dice allo studente come si pronuncia una
 * parola: una parola deve avere una romanizzazione sola, e deve essere quella
 * verificata. Un trattino dentro una parola sola non fa parte della Revised
 * Romanization; è ammesso solo nei nomi propri composti (신촌역 → Sinchon-yeok).
 */
function checkRomanization(vocabulary: { ko: string; rr: string }[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, Set<string>>();
  for (const entry of vocabulary) {
    const forms = seen.get(entry.ko) ?? new Set<string>();
    forms.add(entry.rr);
    seen.set(entry.ko, forms);
  }
  for (const [ko, forms] of [...seen].sort()) {
    if (forms.size > 1) {
      problems.push(`romanizzazione: «${ko}» ha più forme (${[...forms].sort().join(', ')})`);
    }
    const reference = ROMANIZATION_REFERENCE[ko];
    const rr = [...forms][0] ?? '';
    if (reference && foldRoman(rr) !== foldRoman(reference)) {
      problems.push(`romanizzazione: «${ko}» è «${rr}», il riferimento verificato dice «${reference}»`);
    }
    if (rr.includes('-') && !/[역도]$/.test(ko)) {
      problems.push(`romanizzazione: «${ko}» è «${rr}», i trattini non fanno parte della RR`);
    }
    // Una forma che nessuna regola di lettura produce è quasi sempre un refuso
    // («sububi» per 수도비). Il riferimento verificato, quando c'è, è più
    // autorevole del motore: lì il confronto è già avvenuto sopra.
    // Le voci con cifre (1인분) restano fuori: la cifra si legge, ma il motore
    // non sa farlo. Delle frasi si confronta parola per parola, quando i due
    // lati hanno lo stesso numero di parole; altrimenti si tace.
    if (!reference && !/\d/.test(ko)) {
      const korean = ko.split(/\s+/).map((token) => token.replace(/[?!.,]/g, ''));
      const roman = rr.split(/\s+/);
      const aligned =
        korean.length === roman.length && korean.every((token) => /^[가-힣]+$/.test(token));
      if (aligned && !korean.every((token, index) => romanizationMatches(token, roman[index]))) {
        problems.push(
          `romanizzazione: «${ko}» è «${rr}», che non corrisponde alla pronuncia ` +
            `(${korean.map((token) => pronunciationRomanize(token)).join(' ')})`,
        );
      }
    }
  }
  return problems;
}

/**
 * Validazione del curricolo a freddo: `npm run content:check`.
 * Lo store fa la stessa validazione all'avvio, questo comando serve per
 * accorgersene prima di costruire l'immagine.
 */
try {
  const courses = getCourses();
  let lessons = 0;
  let vocab = 0;
  let passages = 0;

  for (const course of courses) {
    const courseLessonList = courseLessons(course);
    lessons += courseLessonList.length;
    vocab += courseLessonList.reduce((sum, lesson) => sum + lesson.vocab.length, 0);
    passages += courseLessonList.reduce((sum, lesson) => sum + (lesson.passages?.length ?? 0), 0);
    console.log(
      `✓ ${course.slug} (${course.level}): ${course.units.length} unità, ${courseLessonList.length} lezioni`,
    );
    for (const unit of course.units) {
      console.log(`   ${unit.id} — ${unit.title}: ${unit.lessons.length} lezioni`);
    }
  }

  // I dialoghi hanno uno schema proprio: se non si validano qui, un copione
  // rotto si scopre solo alla prima richiesta dell'utente, in produzione.
  const dialogues = getDialogues();
  for (const dialogue of dialogues) {
    const answers = dialogue.turns.filter((turn) => turn.answer).length;
    console.log(
      `✓ dialogo ${dialogue.slug} (${dialogue.level}): ${dialogue.turns.length} battute, ${answers} da recitare`,
    );
  }

  // Le consegne del quaderno: uno scrive, il controllo le confronta con il
  // modello. Se il modello non contiene le forme obbligatorie, qui si scopre.
  const writing = getWritingPrompts();
  const perCourse = new Map<string, number>();
  for (const prompt of writing) {
    perCourse.set(prompt.courseSlug, (perCourse.get(prompt.courseSlug) ?? 0) + 1);
  }
  console.log(
    `✓ quaderno: ${writing.length} consegne (${[...perCourse]
      .map(([slug, count]) => `${slug}: ${count}`)
      .join(', ')})`,
  );

  // Il dizionario è ciò che lo studente può cercare: più delle voci elencate
  // nelle lezioni, perché include i gloss dei brani.
  const dictionary = getVocabulary();

  const romanizationProblems = checkRomanization(dictionary);
  if (romanizationProblems.length > 0) {
    console.error('\n✗ Romanizzazione');
    for (const problem of romanizationProblems) console.error(`   ${problem}`);
    process.exit(1);
  }
  const words = new Set(dictionary.map((entry) => entry.ko)).size;
  const verified = new Set(dictionary.filter((entry) => ROMANIZATION_REFERENCE[entry.ko]).map((entry) => entry.ko)).size;
  console.log(
    `\n✓ Romanizzazione: ${words} parole con una sola forma, ` +
      `${verified} già confrontate con il riferimento verificato.`,
  );

  console.log(
    `\nTotale: ${courses.length} corsi, ${lessons} lezioni, ${vocab} voci di lessico, ` +
      `${passages} brani di lettura, ${dialogues.length} dialoghi, ${writing.length} consegne di scrittura.`,
  );
  console.log(`Dizionario: ${dictionary.length} voci cercabili.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
