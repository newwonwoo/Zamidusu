import { brightnessLabel } from '../core/brightness';
import type { PalaceView, StarView, View } from '../core/chart';
import { MUTAGEN_KO, PALACE_SHORT, SCOPE_KO, SCOPE_TAG, TWELVE_SERIES_KO, starLabel, twelveKo } from '../core/names';
import type { Mutagen, Scope } from '../core/names';
import type { Settings } from './state';

export type Highlight = 'sel' | 'tri' | 'opp' | null;

interface CellProps {
  palace: PalaceView;
  view: View;
  settings: Settings;
  highlight: Highlight;
  borrowed: StarView[];
  onSelect: () => void;
}

const brTitle = (b: NonNullable<StarView['brightness']>, mode: Settings['brightness']): string => {
  const l = brightnessLabel(b, mode);
  return `밝기 ${l.text} ${l.symbol} (지수 ${l.score})`;
};

function MutagenBadge({ mutagen, scope }: { mutagen: Mutagen; scope: Scope }) {
  const natal = scope === 'natal';
  return (
    <span
      className={`mut mut-${mutagen}${natal ? '' : ' mut-out'}`}
      title={`${natal ? '생년' : SCOPE_KO[scope]} 화${MUTAGEN_KO[mutagen]}`}
    >
      {natal ? '' : `${SCOPE_TAG[scope]}·`}
      {MUTAGEN_KO[mutagen]}
    </span>
  );
}

export function PalaceCell({ palace, view, settings, highlight, borrowed, onSelect }: CellProps) {
  const scopedName = view.names[palace.branch];
  const scopeMuts = view.mutagens.filter((m) => palace.stars.some((s) => s.key === m.star));
  const mains = palace.stars.filter((s) => s.group === 'main');
  const chips = palace.stars.filter((s) => s.group === 'good' || s.group === 'bad');
  const misc = palace.stars.filter((s) => s.group === 'misc');
  const flow = view.flow[palace.branch];
  const isScopeLife = view.scope !== 'natal' && view.lifeBranch === palace.branch;
  const isAge = view.ageBranch === palace.branch;

  const mutagensOf = (s: StarView) => [
    ...(s.mutagen ? [{ mutagen: s.mutagen, scope: 'natal' as Scope }] : []),
    ...scopeMuts.filter((m) => m.star === s.key).map((m) => ({ mutagen: m.mutagen, scope: m.scope })),
  ];

  const cls = ['cell', highlight ? `hl-${highlight}` : '', isScopeLife ? 'scope-life' : '', palace.isBody ? 'has-body' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-pressed={highlight === 'sel'}
      aria-label={`${PALACE_SHORT[scopedName]} ${palace.ganzhi}궁`}
      data-branch={palace.branch}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="cell-head">
        <span className="gz">{palace.ganzhi}</span>
        <span className="pname">
          {PALACE_SHORT[scopedName]}
          {view.scope !== 'natal' && scopedName !== palace.natalName && <small className="natalname">{PALACE_SHORT[palace.natalName]}</small>}
        </span>
        {palace.isBody && <span className="bodymark" title="신궁">身</span>}
      </div>
      {(isScopeLife || isAge || highlight === 'tri' || highlight === 'opp') && (
        <div className="tags">
          {isScopeLife && <span className="tag tag-life">{SCOPE_KO[view.scope]}명궁</span>}
          {isAge && <span className="tag tag-age">소한</span>}
          {highlight === 'tri' && <span className="tag tag-rel">삼합</span>}
          {highlight === 'opp' && <span className="tag tag-rel">대궁</span>}
        </div>
      )}

      <div className="stars-main">
        {mains.map((s) => (
          <div className="star-main" key={s.key} title={`${s.hanja}${s.brightness ? ` · ${brTitle(s.brightness, settings.brightness)}` : ''}`}>
            <span className="sname">{starLabel(s, settings.nameStyle)}</span>
            {s.brightness && <span className={`br br-t${brightnessLabel(s.brightness, settings.brightness).tier}`}>{brightnessLabel(s.brightness, settings.brightness).text}</span>}
            {mutagensOf(s).map((m, i) => <MutagenBadge key={i} mutagen={m.mutagen} scope={m.scope} />)}
          </div>
        ))}
        {mains.length === 0 && settings.showBorrowed && borrowed.length > 0 && (
          <div className="star-borrowed" title="주성이 없어 맞은편 칸의 주성을 빌려 읽습니다(차성안궁)">
            {borrowed.map((s) => <span key={s.key}>{starLabel(s, settings.nameStyle)}</span>)}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="chips">
          {chips.map((s) => (
            <span className={`chip chip-${s.group}`} key={s.key} title={`${s.hanja}${s.brightness ? ` · ${brTitle(s.brightness, settings.brightness)}` : ''}`}>
              {starLabel(s, settings.nameStyle)}
              {s.brightness && <i className="chip-br">{brightnessLabel(s.brightness, settings.brightness).text}</i>}
              {mutagensOf(s).map((m, i) => <MutagenBadge key={i} mutagen={m.mutagen} scope={m.scope} />)}
            </span>
          ))}
        </div>
      )}

      {flow.length > 0 && (
        <div className="chips flow">
          {flow.map((f) => <span className={`chip chip-flow chip-flow-${f.scope}`} key={f.key} title={f.fullKo}>{f.ko}</span>)}
        </div>
      )}

      {settings.showMisc && misc.length > 0 && (
        <div className="misc">
          {misc.map((s) => <span className={`misc-${s.tone}`} key={s.key} title={s.hanja}>{starLabel(s, settings.nameStyle)}</span>)}
        </div>
      )}

      {settings.showTwelve && (
        <div className="twelve">
          {(['changsheng', 'boshi', 'jiangqian', 'suiqian'] as const).map((k) => (
            <span key={k} title={TWELVE_SERIES_KO[k]}>{twelveKo(k, palace.twelve[k])}</span>
          ))}
          {view.yearlyTwelve && (
            <span className="twelve-year" title="유년 세전/장전 12신">{twelveKo('suiqian', view.yearlyTwelve.suiqian[palace.branch])}·{twelveKo('jiangqian', view.yearlyTwelve.jiangqian[palace.branch])}</span>
          )}
        </div>
      )}

      <div className="cell-foot">
        <span className="decade" title="대한(10년 운) 나이 구간">{palace.decadalRange[0]}–{palace.decadalRange[1]}</span>
      </div>
    </div>
  );
}
