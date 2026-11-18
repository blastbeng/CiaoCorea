import { loadConfig } from '../config';
import { openDb } from '../db/client';
import { hashPassword } from '../auth/password';
import {
  listInvites,
  createInvite,
  revokeInvite,
  countUsableInvites,
} from '../repo/invites';
import {
  createUser,
  findUserByEmail,
  listAccounts,
  updatePasswordHash,
  deleteAccountByEmail,
} from '../repo/users';

/**
 * `npm run accounts -- <comando>` — amministrazione degli account da riga di
 * comando. Non c'è un'interfaccia di amministrazione: gli studenti usano il
 * portale, chi lo gestisce usa questa CLI, e la superficie da proteggere resta
 * quella di un portale di soli studenti.
 *
 * Le password si passano con --password o con la variabile d'ambiente
 * ACCOUNT_PASSWORD: non si mettono in un file del repository.
 */

const HELP = `Uso: npm run accounts -- <comando> [opzioni]

Account
  user:list
  user:new      --email a@b.it --name "Mario" [--password ...]
  user:passwd   --email a@b.it [--password ...]
  user:delete   --email a@b.it --yes

Inviti (REGISTRATION_MODE=invite)
  invite:new    [--label "corso A" | --uses 20 | --days 30]
  invite:list
  invite:revoke <id o etichetta>

La password si può passare con ACCOUNT_PASSWORD nell'ambiente.
`;

interface Args {
  command: string;
  flags: Record<string, string>;
}

/** Allinea a sinistra per l'elenco: niente dipendenze, e il testo resta italiano. */
function pad(value: string, size: number): string {
  return value.length >= size ? value : value + ' '.repeat(size - value.length);
}

function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    if (name === 'yes') {
      flags.yes = '1';
      continue;
    }
    const value = rest[i + 1];
    if (value && !value.startsWith('--')) {
      flags[name] = value;
      i += 1;
    } else {
      flags[name] = '1';
    }
  }

  return { command, flags };
}

function requireFlag(flags: Record<string, string>, name: string): string {
  const value = flags[name]?.trim();
  if (!value) {
    console.error(`Manca --${name}`);
    console.error(HELP);
    process.exit(1);
  }
  return value;
}

function passwordFrom(flags: Record<string, string>): string {
  const value = flags.password?.trim() || process.env.ACCOUNT_PASSWORD?.trim() || '';
  if (value.length < 8) {
    console.error('Password troppo corta: servono almeno 8 caratteri (--password o ACCOUNT_PASSWORD).');
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  const config = loadConfig();
  const db = openDb(config.databaseFile);

  try {
    switch (command) {
      case 'user:list': {
        const rows = listAccounts(db);
        if (rows.length === 0) {
          console.log('Nessun account.');
          return;
        }
        for (const row of rows) {
          console.log(
            `${row.email}  nome=${row.display_name}  ruolo=${row.role}  ` +
              `creato=${row.created_at.slice(0, 10)}  prove=${row.attempts}  sessioni=${row.sessions}`,
          );
        }
        console.log(
          `\nModalità iscrizioni: ${config.registrationMode}` +
            `  ·  posti invito disponibili: ${countUsableInvites(db)}`,
        );
        return;
      }

      case 'user:new': {
        const email = requireFlag(flags, 'email').toLowerCase();
        if (findUserByEmail(db, email)) {
          console.error(`${email} esiste già.`);
          process.exit(1);
        }
        const displayName = flags.name?.trim() || email.split('@')[0] || 'Studente';
        const hash = await hashPassword(passwordFrom(flags));
        createUser(db, { email, displayName, passwordHash: hash });
        console.log(`Creato ${email} (nome: ${displayName})`);
        return;
      }

      case 'user:passwd': {
        const email = requireFlag(flags, 'email').toLowerCase();
        const user = findUserByEmail(db, email);
        if (!user) {
          console.error(`${email} non esiste.`);
          process.exit(1);
        }
        updatePasswordHash(db, user.id, await hashPassword(passwordFrom(flags)));
        console.log(`Password aggiornata per ${email}`);
        return;
      }

      case 'user:delete': {
        const email = requireFlag(flags, 'email').toLowerCase();
        if (flags.yes !== '1') {
          console.error(
            `Cancellare ${email} toglie anche progressi, ripassi e dialoghi.\nRilancia con --yes per confermare.`,
          );
          process.exit(1);
        }
        const removed = deleteAccountByEmail(db, email);
        console.log(removed ? `Cancellato ${email}` : `${email} non esiste.`);
        return;
      }

      case 'invite:new': {
        const label = flags.label?.trim() || 'invito';
        const maxUses = flags.uses ? Number(flags.uses) : 1;
        if (!Number.isInteger(maxUses) || maxUses < 1) {
          console.error('--uses deve essere un numero intero >= 1');
          process.exit(1);
        }
        const days = flags.days ? Number(flags.days) : 0;
        if (!Number.isInteger(days) || days < 0) {
          console.error('--days deve essere un numero intero >= 0');
          process.exit(1);
        }
        const expiresAt = days
          ? new Date(Date.now() + days * 86_400_000).toISOString()
          : null;

        const invite = createInvite(db, { label, maxUses, expiresAt });
        console.log(`Codice:  ${invite.code}`);
        console.log(
          `Etichetta: ${invite.label}   posti: ${invite.maxUses}` +
            `${expiresAt ? `   scadenza: ${expiresAt.slice(0, 10)}` : ''}`,
        );
        console.log('Il codice esiste solo qui: nel database c’è solo il suo hash.');
        return;
      }

      case 'invite:list': {
        const rows = listInvites(db);
        if (rows.length === 0) {
          console.log('Nessun invito creato.');
          return;
        }
        for (const row of rows) {
          const state: string = row.state;
          const line =
            `${row.id.slice(0, 8)}  ${pad(row.label, 20)}  ${pad(state, 8)}  ` +
            `usi ${row.uses}/${row.maxUses}  creato ${row.createdAt.slice(0, 10)}`;
          console.log(row.expiresAt ? `${line}  scadenza ${row.expiresAt.slice(0, 10)}` : line);
        }
        return;
      }

      case 'invite:revoke': {
        const needle = process.argv.slice(3).join(' ').trim();
        if (!needle) {
          console.error('Uso: npm run accounts -- invite:revoke <id o etichetta>');
          process.exit(1);
        }
        const changed = revokeInvite(db, needle);
        console.log(changed > 0 ? `Revocati ${changed} inviti.` : 'Nessun invito corrispondente.');
        return;
      }

      default:
        console.error(`Comando non riconosciuto: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('Comando fallito:', error);
  process.exit(1);
});
