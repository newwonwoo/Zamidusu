import { useMemo, useState } from 'react';
import type { Chart, View } from '../core/chart';
import { plainText } from '../core/glossary';
import { MUTAGEN_KO, PALACE_SHORT, starLabel } from '../core/names';
import type { PalaceExplain, StarExplain } from '../core/explain/compose';
import { buildSummary, explainPalace } from '../core/explain/compose';
import type { SajuChart } from '../core/saju';
import { annotate, TermText } from './TermText';
import { speak, speechSupported, stopSpeech } from './speech';
import type { Settings } from './state';

interface Props {
  chart: Chart;
  view: View;
  saju: SajuChart | null;
  settings: Settings;
  selected: number;
  onSelect: (branch: number) => void;
  notify?: (message: string) => void;
}

const KIND_CLASS: Record<string, string> = {
  summary: 'b-summary', body: 'b-body', natal: 'b-natal', brightness: 'b-bright', mutagen: 'b-mut', saju: 'b-saju',
};

/** 화면에 나오는 순서대로 모든 문장을 모아 용어 첫 등장 처리를 한 번에 한다 */
const flattenTexts = (p: PalaceExplain): string[] => {
  const out: string[] = [p.overview];
  if (p.scopeNote) out.push(p.scopeNote);
  out.push(p.sajuLine);
  if (p.emptyNotice) out.push(p.emptyNotice);
  for (const c of p.combos) out.push(c.where, c.text);
  for (const f of p.flowNotes) out.push(f);
  for (const s of [...p.stars, ...p.borrowed]) for (const b of s.blocks) out.push(b.text);
  return out;
};

export const speechTextOf = (p: PalaceExplain): string => {
  const seen = new Set<string>();
  const parts = [`${p.title}. ${p.overview}`, p.scopeNote ?? '', p.sajuLine, p.emptyNotice ?? ''];
  for (const c of p.combos) parts.push(`${c.name}. ${c.text}`);
  for (const s of [...p.stars, ...p.borrowed]) for (const b of s.blocks) if (b.kind !== 'summary') parts.push(b.text);
  parts.push(...p.flowNotes);
  return parts.filter(Boolean).map((t) => plainText(t, true, seen)).join(' ');
};

export function ExplainPanel({ chart, view, saju, settings, selected, onSelect, notify }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [openMisc, setOpenMisc] = useState(false);
  const rows = useMemo(() => buildSummary(chart, view, settings.brightness), [chart, view, settings.brightness]);
  const pe = useMemo(() => explainPalace(chart, view, selected, { saju, mode: settings.brightness }), [chart, view, saju, selected, settings.brightness]);

  const texts = useMemo(() => flattenTexts(pe), [pe]);
  const segs = useMemo(() => annotate(texts), [texts]);
  let cursor = 0;
  const next = () => segs[cursor++];

  const overview = next();
  const scopeNote = pe.scopeNote ? next() : null;
  const sajuLine = next();
  const emptyNotice = pe.emptyNotice ? next() : null;
  const comboSegs = pe.combos.map(() => ({ where: next(), text: next() }));
  const flowSegs = pe.flowNotes.map(() => next());
  const renderStar = (s: StarExplain) => (
    <article className={`star-card ${s.borrowed ? 'borrowed' : ''}`} key={`${s.borrowed ? 'b' : 'n'}-${s.key}`} data-star={s.key}>
      {s.blocks.map((b, i) => {
        const sg = next();
        return (
          <p className={`blk ${KIND_CLASS[b.kind]}`} key={i}>
            {b.kind !== 'summary' && <span className="blk-label">{b.label}</span>}
            <TermText segments={sg} />
          </p>
        );
      })}
    </article>
  );

  const mainStars = pe.stars.filter((s) => chart.palaces[pe.branch].stars.find((x) => x.key === s.key)?.group !== 'misc');
  const miscStars = pe.stars.filter((s) => chart.palaces[pe.branch].stars.find((x) => x.key === s.key)?.group === 'misc');
  // 렌더 순서(= flattenTexts 순서)를 지키기 위해 별 카드를 미리 만든다
  const starNodes = [...pe.stars, ...pe.borrowed].map((s) => renderStar(s));
  const nodeOf = (s: StarExplain) => starNodes[[...pe.stars, ...pe.borrowed].indexOf(s)];

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(speechTextOf(pe), {
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        notify?.('음성을 재생하지 못했습니다. 이 브라우저에 한국어 음성이 없거나 재생이 막혀 있을 수 있습니다.');
      },
    });
  };

  return (
    <div className="explain">
      <div className="table-wrap">
        <table className="summary">
          <caption>12궁 요약표 <small>(칸을 눌러 해설 보기)</small></caption>
          <thead>
            <tr><th>궁</th><th>칸</th><th>주성 (밝기)</th><th>사화</th><th title="길성 수 : 흉성 수">길·흉</th><th title="주성 밝기의 평균 지수">밝기지수</th><th title="길성÷(길성+흉성)×100">길흉비</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branch} className={r.branch === selected ? 'on' : ''} onClick={() => onSelect(r.branch)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(r.branch); }}>
                <th scope="row">{PALACE_SHORT[r.scopedName]}{r.isBody && <sup title="신궁">身</sup>}</th>
                <td>{r.ganzhi}</td>
                <td>
                  {r.mains.length === 0 ? (
                    <span className="dim">{r.borrowedFrom.length ? `빈 궁 · 차성 ${r.borrowedFrom.join('·')}` : '빈 궁'}</span>
                  ) : (
                    r.mains.map((m) => (
                      <span key={m.key} className="sum-star">{starLabel(m, settings.nameStyle)}{m.brightness && <i className={`br br-t${m.brightness.tier}`}>{m.brightness.text}</i>}</span>
                    ))
                  )}
                </td>
                <td>{r.mutagens.map((m) => <span key={m} className={`mut mut-${m}`}>{MUTAGEN_KO[m]}</span>)}</td>
                <td>{r.score.good}:{r.score.bad}</td>
                <td>{r.score.brightness ?? '–'}</td>
                <td>{r.score.ratio ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">밝기지수는 주성 밝기의 평균(묘100·왕75·평50·한25·함0 기준{settings.brightness === '7' ? ', 7단계 모드는 득67·리50·평33·불17' : ''}), 길흉비는 길성(보좌 8성·록·권·과)÷(길성+흉성(살 6성·기))×100 입니다. 이 구현이 정한 계산식입니다.</p>
      </div>

      <section className="palace-card" aria-live="polite">
        <header>
          <h3>{pe.title} <small>{pe.subtitle}</small></h3>
          {speechSupported() && <button className="ghost" onClick={toggleSpeak} aria-pressed={speaking}>{speaking ? '■ 멈춤' : '▶ 듣기'}</button>}
        </header>
        <p className="overview"><TermText segments={overview} /></p>
        {scopeNote && <p className="scope-note"><TermText segments={scopeNote} /></p>}
        <p className="saju-line"><span className="blk-label">사주 대응</span><TermText segments={sajuLine} /></p>
        <p className="surround-line">
          <span className="blk-label">함께 읽는 칸</span>
          {pe.surround.map((s) => (
            <button className="link" key={s.branch} onClick={() => onSelect(s.branch)}>{PALACE_SHORT[s.name]}({s.ganzhi}·{s.role})</button>
          ))}
        </p>
        {emptyNotice && <p className="empty-notice"><TermText segments={emptyNotice} /></p>}
        {pe.combos.length > 0 && (
          <div className="combos">
            <h4>조합 해설</h4>
            {pe.combos.map((c, i) => (
              <p key={c.id} className="combo">
                <b>{c.name}</b> <small>{c.hanja} · <TermText segments={comboSegs[i].where} /></small>
                <br />
                <TermText segments={comboSegs[i].text} />
              </p>
            ))}
          </div>
        )}
        {pe.flowNotes.length > 0 && (
          <div className="flows">
            <h4>이 칸에 흐르는 운</h4>
            {pe.flowNotes.map((_f, i) => <p key={i}><TermText segments={flowSegs[i]} /></p>)}
          </div>
        )}
        {pe.stars.length === 0 && pe.borrowed.length === 0 && <p className="dim">이 칸에는 해설할 별이 없습니다.</p>}
        <div className="stars-explain">
          {mainStars.length > 0 && <h4>별 해설</h4>}
          {mainStars.map((s) => nodeOf(s))}
          {pe.borrowed.length > 0 && <h4>빌려 온 별 (차성안궁)</h4>}
          {pe.borrowed.map((s) => nodeOf(s))}
          {miscStars.length > 0 && (
            <>
              <button className="more" onClick={() => setOpenMisc((v) => !v)} aria-expanded={openMisc}>
                {openMisc ? '잡성 해설 접기' : `잡성 ${miscStars.length}개 해설 보기`}
              </button>
              {/* 접혀 있어도 용어 첫 등장 순서를 유지하기 위해 항상 렌더하고 CSS 로 숨긴다 */}
              <div className={openMisc ? '' : 'collapsed'}>{miscStars.map((s) => nodeOf(s))}</div>
            </>
          )}
        </div>
        <p className="disclaimer">
          전통 이론에 따른 풀이로 참고용입니다. 통계로 검증된 예측이 아니며 건강·재무·법률 판단을 대신하지 않습니다.
        </p>
      </section>
    </div>
  );
}
