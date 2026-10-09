// 밝기·사화 문장의 공통 재료. 별 카드와 한눈에 보기가 같은 문장을 쓰도록 한곳에 둔다.
// 원칙: 한 문장에 한 가지 뜻(장점·단점·권고를 나눈다), 기호('함', ‘화기’)는 문장 안에서 뜻을 말해 준다.

import { brightnessLabel, to5 } from '../brightness';
import type { Brightness7, BrightnessMode } from '../brightness';
import { MUTAGEN_LONG_KO, SCOPE_KO } from '../names';
import type { Mutagen, Scope } from '../names';
import { josa } from './korean';
import type { StarProfile } from './stars';

export const WHEN: Record<Scope, string> = {
  natal: '타고난 흐름에서는', decadal: '이 10년 동안', yearly: '올해는', monthly: '이번 달은', daily: '오늘은', hourly: '이 시각에는',
};

export const strengthOf = (p: StarProfile): string => p.strength ?? p.tag;
export const cautionOf = (p: StarProfile): string => p.caution ?? '마음이 쓰이는 일';

// ── 밝기(별의 힘) ────────────────────────────────────────────────────────────
export type PowerLevel = 'strong' | 'even' | 'weak' | 'weakest';

export interface PowerParts {
  /** 화면에 보이는 기호: 묘·왕·득·리·평·불·한·함 */
  label: string;
  /** “힘이 가장 약한 자리” */
  phrase: string;
  /** 그래서 어떻게 나타나는지(한 문장) */
  effect: string;
  /** 덧붙이는 조언(없을 수 있음) */
  extra?: string;
  level: PowerLevel;
}

export const powerParts = (b: Brightness7, mode: BrightnessMode, p: StarProfile): PowerParts => {
  const eff: string = mode === '5' ? to5(b) : b;
  const label = brightnessLabel(b, mode).text;
  const s = strengthOf(p);
  const c = cautionOf(p);
  switch (eff) {
    case 'miao':
      return { label, phrase: '힘이 가장 센 자리', effect: `${josa(s, '이/가')} 온전히 드러납니다.`, level: 'strong' };
    case 'wang':
      return { label, phrase: '힘이 센 자리', effect: `${josa(s, '이/가')} 뚜렷하게 드러납니다.`, level: 'strong' };
    case 'de':
      return { label, phrase: '힘이 받쳐 주는 자리', effect: `${josa(s, '을/를')} 무난하게 발휘합니다.`, level: 'strong' };
    case 'li':
      return { label, phrase: '힘이 무난한 자리', effect: `노력한 만큼 ${josa(s, '이/가')} 뒷받침됩니다.`, level: 'even' };
    case 'ping':
      return { label, phrase: '힘이 보통인 자리', effect: `${s}도 나타나지만, ${c}도 비슷하게 나타납니다.`, level: 'even' };
    case 'bu':
      return { label, phrase: '힘이 조금 약한 자리', effect: `${josa(s, '은/는')} 덜 드러납니다. 대신 ${josa(c, '이/가')} 보이기 쉽습니다.`, level: 'weak' };
    case 'han':
      return { label, phrase: '힘이 약한 자리', effect: `${josa(s, '은/는')} 덜 드러납니다. 대신 ${josa(c, '이/가')} 보이기 쉽습니다.`, level: 'weak' };
    default:
      return {
        label,
        phrase: '힘이 가장 약한 자리',
        effect: `${josa(s, '은/는')} 쓰기 어렵습니다. 대신 ${josa(c, '이/가')} 두드러지기 쉽습니다.`,
        extra: '이 점을 알고 보완하면 도움이 됩니다.',
        level: 'weakest',
      };
  }
};

// ── 사화(생년·운에서 붙는 네 가지 변화) ───────────────────────────────────────
export interface MutagenTag {
  mutagen: Mutagen;
  scope: Scope;
}

/** “생년 화록이” / “유년 화기가” — 용어는 {{ }} 로 표시한다 */
export const mutagenSubject = (tag: MutagenTag): string => {
  const long = MUTAGEN_LONG_KO[tag.mutagen];
  const prefix = tag.scope === 'natal' ? '생년' : `{{${SCOPE_KO[tag.scope]}}}`;
  return `${prefix} {{${long}}}${josa(long, '이/가').slice(long.length)}`;
};

/**
 * 사화 문장: [별에 미치는 뜻, 이 칸의 주제에서의 뜻, (조언)]. 첫 문장 앞에 “… 이 별에 붙어 있습니다.”가 온다.
 * 별 카드는 전부, 한눈에 보기는 두 번째부터 쓴다.
 */
export const mutagenEffects = (p: StarProfile, tag: MutagenTag, topic: string): string[] => {
  const s = strengthOf(p);
  const c = cautionOf(p);
  const when = WHEN[tag.scope];
  switch (tag.mutagen) {
    case 'lu':
      return [`${s}에 좋은 일과 인연이 더해집니다.`, `${when} ${topic} 쪽에서 얻는 것이 늘기 쉽습니다.`];
    case 'quan':
      return [`${s}에 추진력과 주도권이 생깁니다.`, `${when} ${topic} 쪽에서 밀어붙이는 힘이 세집니다.`, '고집으로 흐르지 않게 살피세요.'];
    case 'ke':
      return [`${josa(s, '이/가')} 좋은 평판과 인정으로 이어집니다.`, `${when} ${topic} 쪽에서 도움을 받기 쉽습니다.`];
    default:
      return [`${josa(c, '이/가')} 도드라집니다.`, `${when} ${topic} 쪽에서 걱정이 생기거나 일이 막히기 쉽습니다.`, '서두르지 말고 미리 점검하세요.'];
  }
};
