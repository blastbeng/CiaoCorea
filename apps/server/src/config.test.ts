import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('applica i default quando l’ambiente è vuoto', () => {
    const config = loadConfig({});
    expect(config.port).toBe(8080);
    expect(config.registrationMode).toBe('closed');
    expect(config.registrationCode).toBeNull();
    expect(config.seed).toBeNull();
    expect(config.databaseFile).toMatch(/ciaocorea\.db$/);
  });

  it('tratta le variabili presenti ma vuote come non settate', () => {
    // «KEY=» in un file di secrets non deve far fallire l’avvio del server.
    const config = loadConfig({
      REGISTRATION_CODE: '',
      SEED_USER_EMAIL: '   ',
      SEED_USER_PASSWORD: '',
      SEED_USER_NAME: '',
    });
    expect(config.registrationCode).toBeNull();
    expect(config.seed).toBeNull();
  });

  it('normalizza il codice madre e costruisce l’account seed', () => {
    const config = loadConfig({
      REGISTRATION_CODE: 'abcd-2345 efgh',
      SEED_USER_EMAIL: ' Anna@Example.com ',
      SEED_USER_PASSWORD: 'segreta123',
    });
    expect(config.registrationCode).toBe('ABCD2345EFGH');
    expect(config.seed).toEqual({
      email: 'anna@example.com',
      password: 'segreta123',
      displayName: 'Studente',
    });
  });

  it('senza password non crea l’account seed', () => {
    const config = loadConfig({ SEED_USER_EMAIL: 'anna@example.com' });
    expect(config.seed).toBeNull();
  });

  it('rifiuta una modalità di registrazione sconosciuta', () => {
    expect(() => loadConfig({ REGISTRATION_MODE: 'pubblico' })).toThrow(
      /REGISTRATION_MODE/,
    );
  });
});
