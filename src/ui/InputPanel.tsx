import { useId, useMemo } from 'react';
import { BRANCHES_KO } from '../core/ganzhi';
import { ABROAD_ID, CUSTOM_ID, KOREA_ID, PLACES, PLACE_REGIONS, STANDARD_ID } from '../core/place';
import { COMPAT_YEAR_RANGE, MAX_DATE, MIN_DATE, branchOfClock, dayAdvanced, daysInSolarMonth, normalizeBirth, timeRangeLabel } from '../core/time';
import type { CorrectionMode, TimeSettings } from '../core/time';
import { toBirthInput } from './state';
import type { FormState, Settings } from './state';

interface Props {
  form: FormState;
  setForm: (f: FormState) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  compat: boolean;
  errors: string[];
  notes: string[];
  onSubmit: () => void;
  onReset: () => void;
}

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function InputPanel({ form, setForm, settings, setSettings, compat, errors, notes, onSubmit, onReset }: Props) {
  const uid = useId();
  const [yMin, yMax] = compat ? COMPAT_YEAR_RANGE : [MIN_DATE.y, MAX_DATE.y];
  const maxDay = form.calendar === 'solar' ? daysInSolarMonth(form.year, form.month) : 30;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const id = (s: string) => `${uid}-${s}`;

  // 고른 출생지·날짜로 본 “시계 − 보정 후 시각”(한국식이면 30분). 시 드롭다운과 미리보기를 시계 시각 기준으로 보여 준다.
  const timeSettings: TimeSettings = { correction: settings.correction, lateZi: settings.lateZi, compat, lunarBasis: form.lunarBasis };
  const normalized = useMemo(
    () => normalizeBirth(toBirthInput(form), timeSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, settings.correction, settings.lateZi, compat],
  );
  const noonShift = useMemo(() => {
    const r = normalizeBirth({ ...toBirthInput(form), hour: 12, minute: 0 }, timeSettings);
    if (r.ok) return r.value.clockShiftMinutes;
    return !compat && form.placeId === KOREA_ID && settings.correction !== 'none' ? 30 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.calendar, form.leap, form.year, form.month, form.day, form.placeId, form.customLon, form.lunarBasis, settings.correction, compat]);
  /** 시 드롭다운 라벨: 그 시(例 11시)에 걸치는 시진. 한국식은 :30 에 시진이 바뀌므로 홀수 시는 두 시진에 걸친다 */
  const hourLabel = (h: number): string => {
    const a = branchOfClock(h, 0, noonShift);
    const b = branchOfClock(h, 59, noonShift);
    return a === b ? `${h}시 (${BRANCHES_KO[a]}시)` : `${h}시 (${BRANCHES_KO[a]}·${BRANCHES_KO[b]}시)`;
  };
  const preview = normalized.ok && normalized.value.hourKnown && normalized.value.timeIndex !== null ? normalized.value : null;

  return (
    <form
      className="input-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label="출생 정보 입력"
    >
      <fieldset>
        <legend>성별</legend>
        <div className="radios">
          <label><input type="radio" name="gender" checked={form.gender === 'M'} onChange={() => set('gender', 'M')} /> 남</label>
          <label><input type="radio" name="gender" checked={form.gender === 'F'} onChange={() => set('gender', 'F')} /> 여</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>달력</legend>
        <div className="radios">
          <label><input type="radio" name="cal" checked={form.calendar === 'solar'} onChange={() => setForm({ ...form, calendar: 'solar', leap: false, day: Math.min(form.day, daysInSolarMonth(form.year, form.month)) })} /> 양력</label>
          <label><input type="radio" name="cal" checked={form.calendar === 'lunar'} onChange={() => set('calendar', 'lunar')} /> 음력</label>
          {form.calendar === 'lunar' && (
            <label className="leap"><input type="checkbox" checked={form.leap} onChange={(e) => set('leap', e.target.checked)} /> 윤달</label>
          )}
        </div>
      </fieldset>

      <div className="row3">
        <label htmlFor={id('y')}>년
          <select id={id('y')} value={form.year} onChange={(e) => set('year', Number(e.target.value))}>
            {range(yMin, yMax).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label htmlFor={id('m')}>월
          <select id={id('m')} value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value), day: Math.min(form.day, form.calendar === 'solar' ? daysInSolarMonth(form.year, Number(e.target.value)) : 30) })}>
            {range(1, 12).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label htmlFor={id('d')}>일
          <select id={id('d')} value={Math.min(form.day, maxDay)} onChange={(e) => set('day', Number(e.target.value))}>
            {range(1, maxDay).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      <div className="row2">
        <label htmlFor={id('h')}>시
          <select id={id('h')} value={form.hour === null ? 'x' : form.hour} onChange={(e) => set('hour', e.target.value === 'x' ? null : Number(e.target.value))}>
            <option value="x">모름</option>
            {range(0, 23).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
        <label htmlFor={id('mi')}>분
          <select id={id('mi')} value={form.minute} disabled={form.hour === null} onChange={(e) => set('minute', Number(e.target.value))}>
            {range(0, 59).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      {preview && preview.timeIndex !== null && (
        <p className="hint time-preview" aria-live="polite">
          이 시각은 <b>{BRANCHES_KO[preview.timeIndex]}시</b>({timeRangeLabel(preview.timeIndex, preview.clockShiftMinutes)})입니다{dayAdvanced(preview) ? ' · 다음 날 자시로 계산' : ''}
        </p>
      )}

      <label htmlFor={id('p')} className="block">출생지
        <select id={id('p')} value={form.placeId} onChange={(e) => set('placeId', e.target.value)}>
          {!compat && <option value={KOREA_ID}>한국식 (시계 −30분)</option>}
          <option value={STANDARD_ID}>{compat ? '표준시 (보정 안 함)' : '시계 시각 그대로 (보정 안 함)'}</option>
          {compat && <option value={ABROAD_ID}>해외출생 (−30분, 호환)</option>}
          {PLACE_REGIONS.map((r) => (
            <optgroup key={r} label={r}>
              {PLACES.filter((p) => p.region === r).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          ))}
          <option value={CUSTOM_ID}>경도 직접 입력…</option>
        </select>
      </label>
      {form.placeId === KOREA_ID && !compat && (
        <p className="hint">
          {settings.correction === 'none'
            ? '고급 설정에서 “보정 안 함”이 선택되어 있어 시계 시각 그대로 계산합니다.'
            : '한국 표준시(동경 135°)는 한반도 중앙(동경 127.5°)보다 30분 빠릅니다. 그래서 시계에서 30분을 빼고 시진을 정합니다 — 오시는 11:30~13:30, 자시는 23:30~01:30입니다.'}
        </p>
      )}
      {form.placeId === CUSTOM_ID && (
        <label htmlFor={id('lon')} className="block">동경 경도(°, 서쪽은 음수)
          <input id={id('lon')} type="number" step="0.01" min={-180} max={180} value={form.customLon} onChange={(e) => set('customLon', e.target.value)} />
        </label>
      )}

      <fieldset>
        <legend>연도 기준 <small>(자미두수)</small></legend>
        <div className="radios">
          <label><input type="radio" name="yearbasis" checked={form.yearBasis === 'lunarNewYear'} onChange={() => set('yearBasis', 'lunarNewYear')} /> 음력 설</label>
          <label><input type="radio" name="yearbasis" checked={form.yearBasis === 'ipchun'} onChange={() => set('yearBasis', 'ipchun')} /> 입춘</label>
        </div>
      </fieldset>

      {!compat && (
        <fieldset>
          <legend>음력 기준</legend>
          <div className="radios">
            <label><input type="radio" name="lunarbasis" checked={form.lunarBasis === 'korea'} onChange={() => set('lunarBasis', 'korea')} /> 한국 (기본)</label>
            <label><input type="radio" name="lunarbasis" checked={form.lunarBasis === 'china'} onChange={() => set('lunarBasis', 'china')} /> 중국</label>
          </div>
          <p className="hint">한국 만세력과 같은 음력입니다. 초하루를 정하는 순간이 자정 무렵이면 한국·중국 음력이 하루 달라(1900~2050년 중 약 3.6%의 날짜) 명반이 달라질 수 있습니다. 중국 기준은 iztro 등 해외 도구와 같은 값입니다.</p>
        </fieldset>
      )}

      <details className="advanced">
        <summary>고급 설정</summary>
        <fieldset>
          <legend>출생지 시각 보정</legend>
          {([
            ['true', '진태양시 (경도 + 균시차)'],
            ['lmt', '평균태양시 (경도만)'],
            ['none', '보정 안 함 (입력한 시계 그대로 — 한국식 −30분도 끔)'],
          ] as [CorrectionMode, string][]).map(([v, label]) => (
            <label key={v} className="radio-line"><input type="radio" name="corr" checked={settings.correction === v} onChange={() => setSettings({ ...settings, correction: v })} /> {label}</label>
          ))}
          <p className="hint">진태양시·평균태양시는 출생지로 도시를 골랐을 때 적용합니다. 한국식(기본)은 시계에서 30분만 뺍니다(균시차 제외). 한국 표준시 이력(서머타임, 1954~61년 UTC+8:30)은 자동으로 반영합니다.</p>
        </fieldset>
        <fieldset>
          <legend>자시(밤 11시 무렵) 날짜 처리</legend>
          <label className="radio-line"><input type="radio" name="lz" checked={settings.lateZi === 'next'} onChange={() => setSettings({ ...settings, lateZi: 'next' })} /> 다음 날 자시로 봄 (기본)</label>
          <label className="radio-line"><input type="radio" name="lz" checked={settings.lateZi === 'current'} onChange={() => setSettings({ ...settings, lateZi: 'current' })} /> 당일 자시로 봄 (야자시)</label>
        </fieldset>
        <label className="radio-line"><input type="checkbox" checked={settings.leapFix} onChange={(e) => setSettings({ ...settings, leapFix: e.target.checked })} /> 윤달 16일 이후는 다음 달로 보정</label>
      </details>

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {notes.length > 0 && (
        <ul className="notes" aria-label="계산 참고">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}

      <div className="actions">
        <button type="submit" className="primary">명반 보기</button>
        <button type="button" onClick={onReset}>초기화</button>
      </div>
      <p className="hint privacy">입력한 생년월일시는 이 기기에서만 계산되며 어디로도 전송되지 않습니다.</p>
    </form>
  );
}
