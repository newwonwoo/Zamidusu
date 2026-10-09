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

/**
 * 화면에 나오는 순서대로 모든 문장을 모아 용어 첫 등장 처리를 한 번에 한다.
 * 접혀 있는 “사주와 같은 점” 블록은 맨 뒤에 둔다 — 보이는 글에서 먼저 풀이가 붙도록.
 */
export const planOf = (p: PalaceExplain) => {
  const texts: string[] = [];
  const add = (t: string): number => texts.push(t) - 1;
  const at = {
    overview: add(p.overview),
    scopeNote: p.scopeNote ? add(p.scopeNote) : -1,
    head: add(p.glance.headline),
    points: p.glance.points.map((g) => add(g.text)),
    empty: p.emptyNotice ? add(p.emptyNotice) : -1,
    combos: p.combos.map((c) => ({ where: add(c.where), text: add(c.text) })),
    flows: p.flowNotes.map((f) => add(f)),
    blocks: [] as number[][],
    saju: -1,
  };
  const cards = [...p.stars, ...p.borrowed];
  at.blocks = cards.map((s) => s.blocks.map((b) => (b.kind === 'saju' ? -1 : add(b.text))));
  at.saju = add(p.sajuLine);
  cards.forEach((s, i) => s.blocks.forEach((b, k) => { if (b.kind === 'saju') at.blocks[i][k] = add(b.text); }));
  return { texts, at };
};

export const speechTextOf = (p: PalaceExplain): string => {
  const seen = new Set<string>();
  const parts = [`${p.title}. ${p.overview}`, p.scopeNote ?? '', `한눈에 보기. ${p.glance.headline}`];
  for (const g of p.glance.points) parts.push(g.kind === 'star' || g.kind === 'borrow' || g.kind === 'group' ? `${g.label}. ${g.text}` : g.text);
  parts.push(p.emptyNotice ?? '');
  for (const c of p.combos) parts.push(`${c.name}. ${c.text}`);
  for (const s of [...p.stars, ...p.borrowed]) for (const b of s.blocks) if (b.kind !== 'summary') parts.push(b.text);
  parts.push(...p.flowNotes, `사주로 보면. ${p.sajuLine}`);
  return parts.filter(Boolean).map((t) => plainText(t, true, seen)).join(' ');
};

export function ExplainPanel({ chart, view, saju, settings, selected, onSelect, notify }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [openMisc, setOpenMisc] = useState(false);
  const rows = useMemo(() => buildSummary(chart, view, settings.brightness), [chart, view, settings.brightness]);
  const pe = useMemo(() => explainPalace(chart, view, selected, { saju, mode: settings.brightness }), [chart, view, saju, selected, settings.brightness]);

  const plan = useMemo(() => planOf(pe), [pe]);
  const segs = useMemo(() => annotate(plan.texts), [plan]);
  const at = plan.at;
  const overview = segs[at.overview];
  const scopeNote = at.scopeNote >= 0 ? segs[at.scopeNote] : null;
  const glanceHead = segs[at.head];
  const glancePoints = at.points.map((k) => segs[k]);
  const emptyNotice = at.empty >= 0 ? segs[at.empty] : null;
  const comboSegs = at.combos.map((c) => ({ where: segs[c.where], text: segs[c.text] }));
  const flowSegs = at.flows.map((k) => segs[k]);
  const cards = [...pe.stars, ...pe.borrowed];
  const renderStar = (s: StarExplain) => {
    const ci = cards.indexOf(s);
    return (
      <article className={`star-card ${s.borrowed ? 'borrowed' : ''}`} key={`${s.borrowed ? 'b' : 'n'}-${s.key}`} data-star={s.key}>
        {s.blocks.map((b, i) => {
          const sg = segs[at.blocks[ci][i]];
          // 사주와 이름·계산이 같은 별 이야기는 본문 흐름을 끊지 않도록 접어 둔다
          if (b.kind === 'saju') {
            return (
              <details className={`blk ${KIND_CLASS[b.kind]} blk-fold`} key={i}>
                <summary>사주와 같은 점 보기</summary>
                <p><TermText segments={sg} /></p>
              </details>
            );
          }
          return (
            <p className={`blk ${KIND_CLASS[b.kind]}`} key={i}>
              {b.kind !== 'summary' && <span className="blk-label">{b.label}</span>}
              <TermText segments={sg} />
            </p>
          );
        })}
      </article>
    );
  };

  const mainStars = pe.stars.filter((s) => chart.palaces[pe.branch].stars.find((x) => x.key === s.key)?.group !== 'misc');
  const miscStars = pe.stars.filter((s) => chart.palaces[pe.branch].stars.find((x) => x.key === s.key)?.group === 'misc');
  const nodeOf = (s: StarExplain) => renderStar(s);
  const sajuLine = segs[at.saju];

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
      <details className="how-to-read">
        <summary>해설 읽는 법</summary>
        <ol>
          <li>아래 표에서 칸(궁)을 누르면 그 칸의 해설이 표 아래에 나옵니다.</li>
          <li><b>한눈에 보기</b>를 먼저 읽으세요. 결론과 핵심만 쉬운 말로 모았습니다.</li>
          <li><b>별 해설</b>은 근거입니다. 별마다 어떤 별인지, 이 명반에서는 어떻게 나타나는지 적었습니다.</li>
          <li>점선 밑줄이 있는 말은 눌러 보거나(휴대폰) 올려 보면(PC) 쉬운 풀이가 나옵니다.</li>
          <li><b>별의 힘(밝기)</b>은 묘 → 왕 → 평 → 한 → 함 순서로 약해집니다. 약하다고 나쁜 별이 아니라 그 별의 장점이 덜 드러난다는 뜻입니다.</li>
          <li>‘사주로 보면’의 “N개”는 사주의 여덟 글자 중 그 기운에 해당하는 글자의 수입니다. 시를 모르면 여섯 글자로 셉니다.</li>
          <li>모든 해설은 전통 이론에 따른 참고용이며, 건강·재무·법률 판단을 대신하지 않습니다.</li>
        </ol>
      </details>

      <div className="table-wrap">
        <table className="summary">
          <caption>12궁 요약표 <small>(칸을 눌러 해설 보기)</small></caption>
          <thead>
            <tr><th>궁</th><th>칸</th><th>주성 (밝기)</th><th>사화</th><th title="도움이 되는 요소 수 : 신경 쓸 요소 수">길·흉</th><th title="중심 별의 힘을 평균한 점수(0~100)">밝기지수</th><th title="도움이 되는 요소의 비율(%)">길흉비</th></tr>
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
        <p className="table-note">
          밝기지수는 중심 별의 힘을 점수(묘100·왕75·평50·한25·함0{settings.brightness === '7' ? ', 7단계 모드는 득67·리50·평33·불17' : ''})로 바꿔 평균한 값입니다.
          길·흉은 도움이 되는 요소(보좌 8성·화록·화권·화과)와 신경 쓸 요소(살 6성·화기)의 개수, 길흉비는 도움이 되는 요소의 비율(%)입니다. 이 구현이 정한 계산식입니다.
        </p>
      </div>

      <section className="palace-card" aria-live="polite">
        <header>
          <h3>{pe.title} <small>{pe.subtitle}</small></h3>
          {speechSupported() && <button className="ghost" onClick={toggleSpeak} aria-pressed={speaking}>{speaking ? '■ 멈춤' : '▶ 듣기'}</button>}
        </header>
        <p className="overview"><TermText segments={overview} /></p>
        {scopeNote && <p className="scope-note"><TermText segments={scopeNote} /></p>}
        <section className="glance" aria-label="한눈에 보기">
          <h4>한눈에 보기</h4>
          <p className="glance-head"><TermText segments={glanceHead} /></p>
          {pe.glance.points.length > 0 && (
            <ul className="glance-points">
              {pe.glance.points.map((pt, i) => (
                <li key={i} className={`gp gp-${pt.kind}`}>
                  <span className="gp-label">{pt.label}</span>
                  <span className="gp-text"><TermText segments={glancePoints[i]} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="surround-line">
          <span className="blk-label">함께 읽는 칸</span>
          {pe.surround.map((s) => (
            <button className="link" key={s.branch} onClick={() => onSelect(s.branch)}>{PALACE_SHORT[s.name]}({s.ganzhi}·{s.role})</button>
          ))}
          <small className="legend">삼합은 네 칸 간격으로 이어지는 칸, 대궁은 정반대에 있는 맞은편 칸입니다.</small>
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
        <section className="saju-section" aria-label="사주로 보면">
          <h4>사주로 보면</h4>
          <p className="saju-line"><TermText segments={sajuLine} /></p>
        </section>
        <p className="disclaimer">
          전통 이론에 따른 풀이로 참고용입니다. 통계로 검증된 예측이 아니며 건강·재무·법률 판단을 대신하지 않습니다.
        </p>
      </section>
    </div>
  );
}
