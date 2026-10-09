import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { buildMonth } from '../core/calendar';
import type { CalendarCell } from '../core/calendar';
import type { LunarBasis, YMD } from '../core/time';
import type { Settings } from './state';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

interface SettingsDialogProps {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onClose: () => void;
}

export function FontDialog({ settings, setSettings, onClose }: SettingsDialogProps) {
  return (
    <Dialog title="글꼴 설정" onClose={onClose}>
      <fieldset>
        <legend>글자 크기</legend>
        {([['sm', '작게'], ['md', '보통'], ['lg', '크게']] as const).map(([v, label]) => (
          <label key={v} className="radio-line"><input type="radio" name="fs" checked={settings.fontSize === v} onChange={() => setSettings({ ...settings, fontSize: v })} /> {label}</label>
        ))}
      </fieldset>
      <fieldset>
        <legend>글꼴</legend>
        {([['sans', '고딕체'], ['serif', '명조체']] as const).map(([v, label]) => (
          <label key={v} className="radio-line"><input type="radio" name="ff" checked={settings.fontFamily === v} onChange={() => setSettings({ ...settings, fontFamily: v })} /> {label}</label>
        ))}
      </fieldset>
      <p className="preview">미리보기 — 자미 천부 태양 太陽 命宮 庚午</p>
    </Dialog>
  );
}

export function OptionsDialog({ settings, setSettings, onClose }: SettingsDialogProps) {
  const toggle = (k: 'showMisc' | 'showTwelve' | 'showBorrowed' | 'highlightSurround', label: string) => (
    <label className="radio-line"><input type="checkbox" checked={settings[k]} onChange={(e) => setSettings({ ...settings, [k]: e.target.checked })} /> {label}</label>
  );
  return (
    <Dialog title="표시 옵션" onClose={onClose}>
      <fieldset>
        <legend>별 이름</legend>
        {([['ko', '한글'], ['both', '한글 + 한자'], ['hanja', '한자']] as const).map(([v, label]) => (
          <label key={v} className="radio-line"><input type="radio" name="ns" checked={settings.nameStyle === v} onChange={() => setSettings({ ...settings, nameStyle: v })} /> {label}</label>
        ))}
      </fieldset>
      <fieldset>
        <legend>밝기 표시</legend>
        <label className="radio-line"><input type="radio" name="br" checked={settings.brightness === '5'} onChange={() => setSettings({ ...settings, brightness: '5' })} /> 5단계 (묘·왕·평·한·함, 사이트와 같은 방식)</label>
        <label className="radio-line"><input type="radio" name="br" checked={settings.brightness === '7'} onChange={() => setSettings({ ...settings, brightness: '7' })} /> 7단계 (묘·왕·득·리·평·불·함)</label>
      </fieldset>
      <fieldset>
        <legend>칸 안 표시</legend>
        {toggle('showMisc', '잡성(소잡성) 표시')}
        {toggle('showTwelve', '12신 계열 표시 (장생·박사·장전·세전)')}
        {toggle('showBorrowed', '주성이 없는 칸에 맞은편 주성을 흐리게 표시 (차성안궁)')}
        {toggle('highlightSurround', '칸을 누르면 삼방사정 강조')}
      </fieldset>
    </Dialog>
  );
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function ManseDialog({ initial, tz, basis, onClose }: { initial: YMD; tz: string; basis: LunarBasis; onClose: () => void }) {
  const [ym, setYm] = useState({ y: initial.y, m: initial.m });
  const month = useMemo(() => buildMonth(ym.y, ym.m, tz, basis), [ym, tz, basis]);
  const step = (n: number) => {
    const idx = ym.y * 12 + (ym.m - 1) + n;
    const y = Math.floor(idx / 12);
    if (y < 1901 || y > 2099) return;
    setYm({ y, m: (idx % 12) + 1 });
  };
  const today = new Date();
  const isToday = (c: CalendarCell) => c.y === today.getFullYear() && c.m === today.getMonth() + 1 && c.d === today.getDate();
  const isBirth = (c: CalendarCell) => c.y === initial.y && c.m === initial.m && c.d === initial.d;
  return (
    <Dialog title="만세력" onClose={onClose}>
      <div className="manse-nav">
        <button onClick={() => step(-12)} aria-label="이전 해">«</button>
        <button onClick={() => step(-1)} aria-label="이전 달">‹</button>
        <select aria-label="연도" value={ym.y} onChange={(e) => setYm({ ...ym, y: Number(e.target.value) })}>
          {Array.from({ length: 199 }, (_, i) => 1901 + i).map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select aria-label="월" value={ym.m} onChange={(e) => setYm({ ...ym, m: Number(e.target.value) })}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
        <button onClick={() => step(1)} aria-label="다음 달">›</button>
        <button onClick={() => step(12)} aria-label="다음 해">»</button>
        <button className="ghost" onClick={() => setYm({ y: today.getFullYear(), m: today.getMonth() + 1 })}>오늘</button>
      </div>
      <table className="manse" aria-label={`${ym.y}년 ${ym.m}월 만세력`}>
        <thead><tr>{WEEK.map((w, i) => <th key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: Math.ceil((month.leading + month.cells.length) / 7) }, (_, w) => (
            <tr key={w}>
              {Array.from({ length: 7 }, (_, i) => {
                const idx = w * 7 + i - month.leading;
                const c = idx >= 0 ? month.cells[idx] : undefined;
                if (!c) return <td key={i} className="empty" />;
                return (
                  <td key={i} className={`${i === 0 ? 'sun' : i === 6 ? 'sat' : ''} ${isToday(c) ? 'today' : ''} ${isBirth(c) ? 'birth' : ''} ${c.term?.jie ? 'jie' : ''}`}>
                    <b>{c.d}</b>
                    <span className="lunar">{c.lunar.leap ? '윤' : ''}{c.lunar.month}.{c.lunar.day}</span>
                    <span className="gz" title={c.ganzhi}>{c.ganzhiKo}</span>
                    {c.term && <span className="term-day" title={`${c.term.han} ${c.term.hhmm}`}>{c.term.ko} {c.term.hhmm}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">일진은 60갑자, 음력은 월.일입니다. 절기 시각은 {tz === 'Asia/Seoul' ? '한국 시각' : tz} 기준이며 굵은 테두리는 월이 바뀌는 절(節)입니다. {basis === 'korea'
        ? '음력은 한국 기준으로, 한국천문연구원 자료와 같습니다(1900~2050년 전 구간 대조, 2051년 이후는 같은 규칙의 계산값).'
        : '음력은 중국 표준시 기준(iztro·중국 만세력과 같음)이라 한국 만세력과 하루 다른 날이 있습니다.'}</p>
    </Dialog>
  );
}
