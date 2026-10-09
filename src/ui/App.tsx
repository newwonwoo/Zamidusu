import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildView, decadalList, viewForDecade } from '../core/chart';
import type { ViewTarget, YearBasis } from '../core/chart';
import type { Scope } from '../core/names';
import { PALACE_SHORT } from '../core/names';
import { STANDARD_ID } from '../core/place';
import type { ReverseCandidate } from '../core/reverse';
import { birthInputOf } from '../core/reverse';
import { ChartBoard, nowBranch } from './ChartBoard';
import { FontDialog, ManseDialog, OptionsDialog } from './Dialogs';
import { ExplainPanel } from './ExplainPanel';
import { HourUnknown } from './HourUnknown';
import { InputPanel } from './InputPanel';
import { ReverseInput } from './ReverseInput';
import { SajuPanel } from './SajuPanel';
import { computeOutcome, currentDecadeIndex } from './compute';
import type { Outcome } from './compute';
import { defaultForm, defaultSettings, formToQuery, loadSettings, queryToForm, saveSettings } from './state';
import type { FormState, Settings } from './state';
import { stopSpeech } from './speech';

type Dialogs = null | 'font' | 'options' | 'manse';
type MobileTab = 'chart' | 'explain' | 'saju';

const todayTarget = (): ViewTarget => {
  const t = new Date();
  return { date: { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }, timeIndex: nowBranch() };
};

const useIsMobile = (): boolean => {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
};

export default function App() {
  const init = useMemo(() => queryToForm(window.location.search), []);
  const compat = init.compat;
  const mobile = useIsMobile();

  const [form, setForm] = useState<FormState>(init.form);
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [scope, setScope] = useState<Scope>('natal');
  const [decadeIndex, setDecadeIndex] = useState(0);
  const [target, setTarget] = useState<ViewTarget>(todayTarget);
  const [selected, setSelected] = useState(0);
  const [rightTab, setRightTab] = useState<'explain' | 'saju'>('explain');
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [inputTab, setInputTab] = useState<'basic' | 'reverse'>('basic');
  const [inputOpen, setInputOpen] = useState(true);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const firstRun = useRef(true);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const run = useCallback(
    (f: FormState, s: Settings, opts: { keepView?: boolean } = {}) => {
      stopSpeech();
      const r = computeOutcome(f, s, compat);
      if (!r.ok) {
        setErrors(r.errors);
        return;
      }
      setErrors([]);
      setOutcome(r.outcome);
      if (r.outcome.kind === 'chart') {
        const chart = r.outcome.chart;
        if (!opts.keepView) {
          setSelected(chart.meta.soulBranch);
          setScope('natal');
        }
        setDecadeIndex(currentDecadeIndex(chart));
        if (mobile && !opts.keepView) setInputOpen(false);
      }
    },
    [compat, mobile],
  );

  // 첫 화면: 주소에 입력값이 있으면 그 값으로, 없으면 예시(T6)로 명반을 보여 준다
  useEffect(() => {
    run(form, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 계산에 영향을 주는 설정이 바뀌면 다시 계산(첫 마운트는 제외)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (outcome) run(form, settings, { keepView: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.correction, settings.lateZi, settings.leapFix]);

  useEffect(() => {
    document.documentElement.dataset.fs = settings.fontSize;
    document.documentElement.dataset.ff = settings.fontFamily;
  }, [settings.fontSize, settings.fontFamily]);

  const chart = outcome?.kind === 'chart' ? outcome.chart : null;

  const view = useMemo(() => {
    if (!chart) return null;
    try {
      if (scope === 'natal') return buildView(chart, 'natal', null);
      if (scope === 'decadal') return viewForDecade(chart, decadalList(chart)[decadeIndex].startAge);
      return buildView(chart, scope, target);
    } catch {
      return buildView(chart, 'natal', null);
    }
  }, [chart, scope, decadeIndex, target]);

  const changeYearBasis = (b: YearBasis) => {
    const next = { ...form, yearBasis: b };
    setForm(next);
    run(next, settings, { keepView: true });
  };

  const useCandidate = (c: ReverseCandidate, year: number) => {
    const bi = birthInputOf(c, year, form.gender);
    const next: FormState = {
      ...form, calendar: 'lunar', leap: false, year: bi.year, month: bi.month, day: bi.day, hour: bi.hour, minute: 0, placeId: STANDARD_ID,
      yearBasis: 'lunarNewYear',
    };
    setForm(next);
    setInputTab('basic');
    run(next, settings);
    showToast(`역산 후보로 명반을 열었습니다 (음력 ${year}년 ${c.month}월 ${c.day}일)`);
  };

  const pickHour = (branch: number) => {
    const next = { ...form, hour: branch === 0 ? 0 : branch * 2, minute: 0 };
    setForm(next);
    run(next, settings);
  };

  const saveImage = async () => {
    if (!boardRef.current) return;
    setBusy(true);
    // 선택·삼방사정 강조는 화면용이므로 저장하는 동안만 끈다
    boardRef.current.classList.add('exporting');
    try {
      const { toPng } = await import('html-to-image');
      const bg = getComputedStyle(document.body).backgroundColor;
      const url = await toPng(boardRef.current, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
      const a = document.createElement('a');
      const n = outcome?.norm.civil;
      a.href = url;
      // 파일명은 ASCII 로 둔다: 한글 이름은 data/blob 링크에서 브라우저가 이름을 버리고 'download'(확장자 없음)로 저장하는 경우가 있다.
      a.download = `ziwei-chart-${n ? `${n.y}${String(n.m).padStart(2, '0')}${String(n.d).padStart(2, '0')}` : 'untitled'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('명반 이미지를 저장했습니다');
    } catch {
      showToast('이미지를 저장하지 못했습니다. 브라우저를 바꿔 보세요');
    } finally {
      boardRef.current?.classList.remove('exporting');
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${formToQuery(form)}${compat ? '&compat=1' : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('링크를 복사했습니다 (입력값은 주소에만 담기고 서버로 전송되지 않습니다)');
    } catch {
      window.prompt('아래 링크를 복사하세요', url);
    }
  };

  const reset = () => {
    setForm(defaultForm());
    setErrors([]);
    setOutcome(null);
    setSettings({ ...settings, correction: defaultSettings().correction });
  };

  const selectCell = (b: number) => {
    setSelected(b);
    stopSpeech();
  };

  const goMobile = (t: MobileTab) => {
    setMobileTab(t);
    if (t === 'explain') setRightTab('explain');
    if (t === 'saju') setRightTab('saju');
    window.scrollTo({ top: 0 });
  };

  const sideContent = (() => {
    if (!outcome) return <p className="dim pad">입력을 마치고 ‘명반 보기’를 누르면 해설이 나타납니다.</p>;
    if (outcome.kind === 'hour-unknown') return <p className="dim pad">태어난 시를 정하면 궁 해설과 사주 비교가 나타납니다.</p>;
    if (!view) return null;
    return rightTab === 'explain' ? (
      <ExplainPanel chart={outcome.chart} view={view} saju={outcome.saju} settings={settings} selected={selected} onSelect={selectCell} notify={showToast} />
    ) : (
      <SajuPanel chart={outcome.chart} saju={outcome.saju} comparison={outcome.comparison} onYearBasis={changeYearBasis} />
    );
  })();

  const correctionNote = outcome?.norm.correction?.note ?? null;

  return (
    <div className="app" data-mobile-tab={mobileTab}>
      <header className="app-header">
        <div>
          <h1>자미두수 명반</h1>
          <p>사주와 나란히 보는 새 해설 · 계산은 이 기기에서만</p>
        </div>
      </header>

      {compat && (
        <div className="compat-banner" role="alert">
          <b>원본 호환 모드 (검증 전용)</b> — 사이트의 알려진 오류(I-01~I-08)를 일부러 재현합니다. 결과를 일반 용도로 쓰지 마세요.
          {chart && chart.compatApplied.length > 0 && <small> 적용: {chart.compatApplied.join(' · ')}</small>}
        </div>
      )}

      <nav className="mobile-tabs" aria-label="화면 전환">
        {([['chart', '명반'], ['explain', '궁 해설'], ['saju', '사주 비교']] as [MobileTab, string][]).map(([k, label]) => (
          <button key={k} className={mobileTab === k ? 'on' : ''} aria-current={mobileTab === k ? 'page' : undefined} onClick={() => goMobile(k)}>{label}</button>
        ))}
      </nav>

      <aside className="input-panel" aria-label="입력">
        <div className="input-head">
          <div className="seg" role="tablist" aria-label="입력 방식">
            <button role="tab" aria-selected={inputTab === 'basic'} className={inputTab === 'basic' ? 'on' : ''} onClick={() => setInputTab('basic')}>기본 입력</button>
            <button role="tab" aria-selected={inputTab === 'reverse'} className={inputTab === 'reverse' ? 'on' : ''} onClick={() => setInputTab('reverse')}>역산 입력</button>
          </div>
          {mobile && <button className="ghost" onClick={() => setInputOpen((v) => !v)} aria-expanded={inputOpen}>{inputOpen ? '접기' : '입력 열기'}</button>}
        </div>
        <div className={mobile && !inputOpen ? 'collapsed' : ''}>
          {inputTab === 'basic' ? (
            <InputPanel
              form={form}
              setForm={setForm}
              settings={settings}
              setSettings={setSettings}
              compat={compat}
              errors={errors}
              notes={[...(outcome?.norm.notes ?? []), ...(correctionNote && outcome?.norm.correction?.deltaMinutes ? [`출생지 보정: ${correctionNote}`] : [])]}
              onSubmit={() => run(form, settings)}
              onReset={reset}
            />
          ) : (
            <ReverseInput onUse={useCandidate} />
          )}
        </div>
      </aside>

      <main className="chart-panel">
        {!outcome && <p className="empty-state">왼쪽에서 출생 정보를 입력하고 <b>명반 보기</b>를 누르세요.</p>}
        {outcome?.kind === 'hour-unknown' && <HourUnknown norm={outcome.norm} options={outcome.options} settings={settings} onPick={pickHour} />}
        {chart && view && outcome?.kind === 'chart' && (
          <ChartBoard
            chart={chart}
            view={view}
            comparison={outcome.comparison}
            settings={settings}
            scope={scope}
            onScope={setScope}
            decadeIndex={decadeIndex}
            onDecade={setDecadeIndex}
            target={target}
            onTarget={setTarget}
            selected={selected}
            onSelect={(b) => {
              selectCell(b);
            }}
            boardRef={boardRef}
            tools={{
              onSaveImage: saveImage,
              onManse: () => setDialog('manse'),
              onFont: () => setDialog('font'),
              onOptions: () => setDialog('options'),
              onCopyLink: copyLink,
              busy,
            }}
          />
        )}
        {chart && view && mobile && mobileTab === 'chart' && (
          <button className="peek" onClick={() => goMobile('explain')}>
            ▼ {PALACE_SHORT[view.names[selected]]} 해설 보기
          </button>
        )}
      </main>

      <section className="side-panel" aria-label="해설">
        <div className="seg side-tabs" role="tablist" aria-label="우측 패널">
          <button role="tab" aria-selected={rightTab === 'explain'} className={rightTab === 'explain' ? 'on' : ''} onClick={() => setRightTab('explain')}>궁 해설</button>
          <button role="tab" aria-selected={rightTab === 'saju'} className={rightTab === 'saju' ? 'on' : ''} onClick={() => setRightTab('saju')}>사주 비교</button>
        </div>
        {sideContent}
      </section>

      <footer className="app-footer">
        <p>분석 원장 v3를 바탕으로 새로 만든 재구현입니다. 해설 문장은 모두 새로 작성했으며 전통 이론에 따른 참고용입니다.</p>
      </footer>

      {dialog === 'font' && <FontDialog settings={settings} setSettings={setSettings} onClose={() => setDialog(null)} />}
      {dialog === 'options' && <OptionsDialog settings={settings} setSettings={setSettings} onClose={() => setDialog(null)} />}
      {dialog === 'manse' && (
        <ManseDialog
          initial={outcome?.norm.civil ? { y: outcome.norm.civil.y, m: outcome.norm.civil.m, d: outcome.norm.civil.d } : todayTarget().date}
          tz={outcome?.norm.tz ?? 'Asia/Seoul'}
          onClose={() => setDialog(null)}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
