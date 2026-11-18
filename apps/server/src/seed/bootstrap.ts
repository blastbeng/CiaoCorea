import type { Db } from '../db/client';
import { hashPassword } from '../auth/password';
import { createUser, findUserByEmail } from '../repo/users';

export interface SeedCredentials {
  email: string;
  password: string;
  displayName: string;
}

export interface SeedResult {
  created: boolean;
  email: string;
}

/**
 * L'app non ha registrazione pubblica: l'unico studente viene creato qui, da
 * credenziali che vivono fuori dal repository. Se l'utente esiste già non si
 * tocca la password, così un riavvio del container non cambia le credenziali
 * sotto i piedi a chi sta studiando.
 */
export async function ensureSeedUser(db: Db, seed: SeedCredentials): Promise<SeedResult> {
  const email = seed.email.trim().toLowerCase();
  const existing = findUserByEmail(db, email);
  if (existing) return { created: false, email: existing.email };

  await createUser(db, {
    email,
    displayName: seed.displayName,
    passwordHash: await hashPassword(seed.password),
  });

  return { created: true, email };
}
