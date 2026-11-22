import { describe, expect, it } from 'vitest';
import { missingVoiceHint, pickKoreanVoice } from './pronounce';

describe('pickKoreanVoice', () => {
  it('sceglie ko-KR anche quando compare dopo altre voci coreane', () => {
    const voices = [
      { name: 'Korean (Korea)', lang: 'ko' },
      { name: 'Microsoft Heami', lang: 'ko-KR' },
      { name: 'Alice', lang: 'it-IT' },
    ];
    expect(pickKoreanVoice(voices)?.name).toBe('Microsoft Heami');
  });

  it('accetta la variante con underscore', () => {
    const voices = [{ name: 'Yuna', lang: 'ko_KR' }];
    expect(pickKoreanVoice(voices)?.name).toBe('Yuna');
  });

  it('non usa mai una voce non coreana', () => {
    const voices = [
      { name: 'Alice', lang: 'it-IT' },
      { name: 'Samantha', lang: 'en-US' },
    ];
    expect(pickKoreanVoice(voices)).toBeNull();
  });

  it('preferisce una voce coreana locale a una remota', () => {
    const voices = [
      { name: 'Korean online', lang: 'ko-KR', localService: false },
      { name: 'Korean device', lang: 'ko-KR', localService: true },
    ];
    expect(pickKoreanVoice(voices)?.name).toBe('Korean device');
  });

  it('regge una lista vuota', () => {
    expect(pickKoreanVoice([])).toBeNull();
  });
});

describe('missingVoiceHint', () => {
  it('dice che il dispositivo non ha una voce coreana', () => {
    expect(missingVoiceHint('it-IT')).toMatch(/voce coreana/i);
  });

  it('quando il browser non ha proprio la sintesi vocale lo dice', () => {
    expect(missingVoiceHint(null)).toMatch(/non supporta|non ha/i);
  });
});
