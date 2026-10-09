// 시 “모름”(N-06): 시간이 정해지지 않으면 명궁·오행국이 정해지지 않으므로, 12시진별로 달라지는 값을 비교해 보여 준다.

import { useMemo } from 'react';
import { buildChart } from '../core/chart';
import type { ChartOptions } from '../core/chart';
import { BRANCHES_KO } from '../core/ganzhi';
import { starLabel, starMeta } from '../core/names';
import type { NormalizedBirth } from '../core/time';
import { timeRangeLabel } from '../core/time';
import type { Settings } from './state';

interface Props {
  norm: NormalizedBirth;
  options: ChartOptions;
  settings: Settings;
  onPick: (branch: number) => void;
}

export function HourUnknown({ norm, options, settings, onPick }: Props) {
  const rows = useMemo(
    () =>
      Array.from({ length: 12 }, (_, b) => {
        const chart = buildChart({ ...norm, timeIndex: b, hourKnown: true }, options);
        const soul = chart.palaces[chart.meta.soulBranch];
        let mains = soul.stars.filter((s) => s.group === 'main');
        let borrowed = false;
        if (mains.length === 0) {
          mains = chart.palaces[(chart.meta.soulBranch + 6) % 12].stars.filter((s) => s.group === 'main');
          borrowed = true;
        }
        return {
          b,
          soul: soul.ganzhi,
          body: chart.palaces[chart.meta.bodyBranch].ganzhi,
          five: chart.meta.fiveElements.ko,
          mains: mains.map((s) => starLabel(starMeta(s.key), settings.nameStyle)),
          borrowed,
          dir: chart.meta.decadalForward ? '순행' : '역행',
        };
      }),
    [norm, options, settings.nameStyle],
  );
  return (
    <section className="hour-unknown" aria-label="시 모름 안내">
      <h2>태어난 시를 모르면 명반이 정해지지 않습니다</h2>
      <p>명궁과 오행국이 태어난 시로 정해지기 때문입니다. 아래 표는 시진마다 달라지는 값입니다. 가장 가까운 시진을 골라 명반을 열어 보거나, 기억나는 정보로 ‘역산 입력’을 써 보세요.</p>
      <div className="table-wrap">
        <table className="hour-table">
          <thead><tr><th scope="col">시진</th><th scope="col">시간대</th><th scope="col">명궁</th><th scope="col">신궁</th><th scope="col">오행국</th><th scope="col">명궁 주성</th><th scope="col">대한</th><th scope="col"><span className="sr-only">선택</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.b}>
                <th scope="row">{BRANCHES_KO[r.b]}시</th>
                <td>{timeRangeLabel(r.b, norm.clockShiftMinutes)}</td>
                <td>{r.soul}</td>
                <td>{r.body}</td>
                <td>{r.five}</td>
                <td>{r.mains.length ? `${r.borrowed ? '(차성) ' : ''}${r.mains.join('·')}` : '–'}</td>
                <td>{r.dir}</td>
                <td><button type="button" onClick={() => onPick(r.b)}>이 시진으로 보기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">시 모름 상태의 사주는 연·월·일 3기둥만 확정됩니다(시주 제외).</p>
    </section>
  );
}
