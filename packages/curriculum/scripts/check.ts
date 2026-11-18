import { courseLessons, getCourses, getDialogues, getVocabulary } from '../src/index';

/**
 * Validazione del curricolo a freddo: `npm run content:check`.
 * Il server fa la stessa validazione all'avvio, questo comando serve per
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

  // Il dizionario è ciò che lo studente può cercare: più delle voci elencate
  // nelle lezioni, perché include i gloss dei brani.
  const dictionary = getVocabulary();

  console.log(
    `\nTotale: ${courses.length} corsi, ${lessons} lezioni, ${vocab} voci di lessico, ` +
      `${passages} brani di lettura, ${dialogues.length} dialoghi.`,
  );
  console.log(`Dizionario: ${dictionary.length} voci cercabili.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
