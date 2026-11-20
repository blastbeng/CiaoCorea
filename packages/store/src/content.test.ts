import { describe, expect, it } from 'vitest';
import { courseLessons, getCourses, getDialogues } from '@ciaocorea/curriculum';
import { checkDialogueTurn, isCorrect, isStudentTurn } from '@ciaocorea/engine';

/**
 * Lo schema valida la forma del curricolo; qui si valida la sostanza: ogni
 * soluzione scritta nei dati deve essere effettivamente accettata dal
 * correggitore, e ogni battuta di "Tu" deve passare con la sua stessa forma
 * coreana. È il controllo che si rompe quando si aggiunge una lezione e la
 * risposta dell'esercizio non coincide con le opzioni, o con la normalizzazione
 * usata in produzione.
 */
describe('curricolo reale: le soluzioni devono essere correggibili', () => {
  it('ogni esercizio accetta la propria risposta', () => {
    for (const course of getCourses()) {
      for (const lesson of courseLessons(course)) {
        for (const exercise of lesson.exercises) {
          expect(isCorrect(exercise, exercise.answer), `${course.slug}/${exercise.id}`).toBe(true);
          const alternates = 'accept' in exercise ? (exercise.accept ?? []) : [];
          for (const alternate of alternates) {
            expect(isCorrect(exercise, alternate), `${course.slug}/${exercise.id} (${alternate})`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it('ogni battuta di "Tu" accetta la propria forma coreana', () => {
    for (const dialogue of getDialogues()) {
      for (const turn of dialogue.turns) {
        if (isStudentTurn(turn)) {
          expect(checkDialogueTurn(turn, turn.ko), `${dialogue.slug}/${turn.id}`).toBe(true);
        }
      }
    }
  });
});
