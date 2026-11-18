#!/usr/bin/env node
/**
 * Avvio di sviluppo: API con ricarica automatica e Vite con proxy su /api.
 * Due processi, un solo comando, e Ctrl-C li chiude entrambi: senza questo,
 * il server resta appeso alla porta 8080 e il giro dopo sembra rotto.
 */
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  spawn(npm, ['run', 'dev:watch'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev:web'], { stdio: 'inherit' }),
];

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

for (const child of children) {
  child.on('exit', (code) => {
    // Se uno dei due muore, l'altro non ha senso: si chiude tutto.
    if (!stopping) stop(code ?? 0);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
