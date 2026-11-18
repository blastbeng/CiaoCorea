import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client';
import { nowIso } from '../db/client';
import { generateInviteCode, hashInviteCode } from '../auth/codes';

export interface InviteRow {
  id: string;
  code_hash: string;
  label: string;
  max_uses: number;
  uses: number;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** L'invito com'è visto da chi lo amministra: senza hash, con il suo stato. */
export interface InviteView {
  id: string;
  label: string;
  maxUses: number;
  uses: number;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  state: 'valid' | 'used' | 'expired' | 'revoked';
}

export interface NewInvite {
  label: string;
  maxUses?: number;
  /** Scadenza ISO; null = senza scadenza. */
  expiresAt?: string | null;
}

export interface CreatedInvite {
  id: string;
  /** Il codice in chiaro: esiste solo qui, in DB resta l'hash. */
  code: string;
  label: string;
  maxUses: number;
  expiresAt: string | null;
}

export function createInvite(
  db: Db,
  { label, maxUses = 1, expiresAt = null }: NewInvite,
): CreatedInvite {
  const code = generateInviteCode();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO invites(id, code_hash, label, max_uses, uses, created_at, expires_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, hashInviteCode(code), label, Math.max(1, maxUses), nowIso(), expiresAt ?? null);

  return { id, code, label, maxUses: Math.max(1, maxUses), expiresAt: expiresAt ?? null };
}

function stateOf(row: InviteRow, now: Date): InviteView['state'] {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at) < now) return 'expired';
  if (row.uses >= row.max_uses) return 'used';
  return 'valid';
}

export function listInvites(db: Db): InviteView[] {
  const now = new Date();
  const rows = db
    .prepare('SELECT * FROM invites ORDER BY created_at DESC')
    .all() as unknown as InviteRow[];

  const views: InviteView[] = [];
  for (const row of rows) {
    views.push({
      id: row.id,
      label: row.label,
      maxUses: row.max_uses,
      uses: row.uses,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
      state: stateOf(row, now),
    });
  }
  return views;
}

/**
 * L'invito corrisponde e può ancora essere usato? La scadenza e l'esaurimento
 * si controllano qui, non nel consumer: un invito usato tutte le sue volte
 * smette di esistere, e chi lo ha in mano deve sentirselo dire.
 */
export function findUsableInvite(db: Db, code: string): InviteRow | null {
  const row = db
    .prepare('SELECT * FROM invites WHERE code_hash = ?')
    .get(hashInviteCode(code)) as InviteRow | undefined;
  if (!row) return null;

  const now = new Date();
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < now) return null;
  if (row.uses >= row.max_uses) return null;
  return row;
}

/**
 * Consuma un invito. La condizione `uses < max_uses` è nella WHERE, così due
 * iscrizioni che arrivano sullo stesso invito con un solo posto non lo
 * consumano entrambe: la seconda trova zero righe aggiornate e viene rifiutata.
 */
export function consumeInvite(db: Db, inviteId: string): boolean {
  const result = db
    .prepare(
      `UPDATE invites
         SET uses = uses + 1, last_used_at = ?
       WHERE id = ? AND uses < max_uses AND revoked_at IS NULL`,
    )
    .run(nowIso(), inviteId);
  return Number(result.changes) > 0;
}

/**
 * Revoca per id o per etichetta. Serve a ritirare un codice girato a troppe
 * persone, senza dover conoscere l'id esatto.
 */
export function revokeInvite(db: Db, idOrLabel: string): number {
  const needle = idOrLabel.trim();
  if (!needle) return 0;

  const byId = db.prepare('UPDATE invites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL');
  const changes = Number(byId.run(nowIso(), needle).changes);
  if (changes > 0) return changes;

  const byLabel = db.prepare(
    'UPDATE invites SET revoked_at = ? WHERE label = ? AND revoked_at IS NULL',
  );
  return Number(byLabel.run(nowIso(), needle).changes);
}

/** Quanti inviti ancora utilizzabili ci sono: serve alla CLI e alla pagina di accesso. */
export function countUsableInvites(db: Db): number {
  const rows = db
    .prepare('SELECT max_uses, uses, expires_at, revoked_at FROM invites')
    .all() as unknown as Pick<InviteRow, 'max_uses' | 'uses' | 'expires_at' | 'revoked_at'>[];
  const now = new Date();

  return rows.reduce(
    (total, row) =>
      total +
      (row.revoked_at || (row.expires_at && new Date(row.expires_at) < now) ? 0 : Math.max(0, row.max_uses - row.uses)),
    0,
  );
}
