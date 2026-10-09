// UI 상태: 공유 링크(해시)·예전 링크(쿼리) 호환·입력 변환. 화면 없이 검증할 수 있는 부분만 모았다.
import { describe, expect, it } from 'vitest';
import { CUSTOM_ID } from '../src/core/place';
import { defaultForm, formFromLocation, formToQuery, toBirthInput } from '../src/ui/state';
import type { FormState } from '../src/ui/state';
import { rng } from './helpers';

describe('공유 링크', () => {
  it('formToQuery → 해시 → formFromLocation 으로 입력이 그대로 돌아온다 (무작위 500건)', () => {
    const r = rng(31);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
    for (let i = 0; i < 500; i++) {
      const f: FormState = {
        gender: pick(['M', 'F'] as const),
        calendar: pick(['solar', 'lunar'] as const),
        leap: false,
        year: 1900 + Math.floor(r() * 201),
        month: 1 + Math.floor(r() * 12),
        day: 1 + Math.floor(r() * 31),
        hour: r() < 0.15 ? null : Math.floor(r() * 24),
        minute: Math.floor(r() * 60),
        placeId: pick(['standard', '특별·광역시-서울', '제주-제주', CUSTOM_ID]),
        customLon: pick(['127.5', '-73.9', '139.69']),
        yearBasis: pick(['lunarNewYear', 'ipchun'] as const),
        lunarBasis: pick(['korea', 'china'] as const),
      };
      if (f.calendar === 'lunar') f.leap = r() < 0.3;
      const back = formFromLocation({ search: '', hash: `#${formToQuery(f)}` });
      expect(back.auto).toBe(true);
      expect(back.form.gender).toBe(f.gender);
      expect(back.form.calendar).toBe(f.calendar);
      expect(back.form.leap).toBe(f.calendar === 'lunar' && f.leap);
      expect([back.form.year, back.form.month, back.form.day]).toEqual([f.year, f.month, f.day]);
      expect(back.form.hour).toBe(f.hour);
      expect(back.form.minute).toBe(f.hour === null ? 0 : f.minute);
      expect(back.form.placeId).toBe(f.placeId);
      expect(back.form.yearBasis).toBe(f.yearBasis);
      expect(back.form.lunarBasis).toBe(f.lunarBasis);
      if (f.placeId === CUSTOM_ID) expect(back.form.customLon).toBe(f.customLon);
    }
  });

  it('입력값은 쿼리가 아니라 해시에 담긴다: 쿼리에 생년월일이 없으면 자동 실행하지 않는다', () => {
    const none = formFromLocation({ search: '', hash: '' });
    expect(none.auto).toBe(false);
    expect(none.form).toEqual(defaultForm());
    const q = formToQuery({ ...defaultForm(), year: 1985, month: 7, day: 9 });
    expect(q).toMatch(/y=1985/);
    expect(formFromLocation({ search: '', hash: `#${q}` }).form.year).toBe(1985);
  });

  it('예전 형식(?y=…&m=…&d=…)도 읽고, 둘 다 있으면 해시가 우선한다', () => {
    const legacy = formFromLocation({ search: '?y=1991&m=9&d=5&h=8&g=F', hash: '' });
    expect(legacy.auto).toBe(true);
    expect([legacy.form.year, legacy.form.month, legacy.form.day, legacy.form.hour, legacy.form.gender]).toEqual([1991, 9, 5, 8, 'F']);
    const both = formFromLocation({ search: '?y=1991&m=9&d=5&h=8', hash: '#y=1980&m=7&d=22&h=10' });
    expect([both.form.year, both.form.month, both.form.day, both.form.hour]).toEqual([1980, 7, 22, 10]);
  });

  it('해시 앞의 ? 는 무시하고, 날짜가 모자란 해시는 쓰지 않는다', () => {
    expect(formFromLocation({ search: '', hash: '#?y=2000&m=2&d=3&h=4' }).form.year).toBe(2000);
    const partial = formFromLocation({ search: '?y=1999&m=1&d=2', hash: '#y=2000&m=2' });
    expect(partial.form.year).toBe(1999); // 해시에 일이 없으므로 쿼리를 쓴다
  });

  it('원본 호환 모드 스위치(compat=1)는 쿼리·해시 어디서든 켠다', () => {
    expect(formFromLocation({ search: '?compat=1', hash: '' }).compat).toBe(true);
    expect(formFromLocation({ search: '', hash: '#compat=1&y=1990&m=1&d=30' }).compat).toBe(true);
    expect(formFromLocation({ search: '', hash: '#y=1990&m=1&d=30' }).compat).toBe(false);
  });

  it('시를 모르는 링크(h=)는 시 없음으로 복원된다', () => {
    const r = formFromLocation({ search: '', hash: '#y=1990&m=1&d=30&h=&g=M' });
    expect(r.form.hour).toBeNull();
    expect(r.auto).toBe(true);
  });
});

describe('입력 변환', () => {
  it('직접 입력 경도: 숫자는 그대로, 빈 칸은 “입력 없음”이다 (Number("") === 0 으로 그리니치가 되면 안 된다)', () => {
    const base = { ...defaultForm(), placeId: CUSTOM_ID };
    expect(toBirthInput({ ...base, customLon: '127.5' }).customLon).toBe(127.5);
    expect(toBirthInput({ ...base, customLon: '-73.9' }).customLon).toBe(-73.9);
    expect(toBirthInput({ ...base, customLon: '' }).customLon).toBeUndefined();
    expect(toBirthInput({ ...base, customLon: '   ' }).customLon).toBeUndefined();
    expect(Number.isNaN(toBirthInput({ ...base, customLon: 'abc' }).customLon)).toBe(true);
    // 다른 출생지에서는 경도 칸의 값이 계산에 들어가지 않는다
    expect(toBirthInput({ ...defaultForm(), customLon: '12' }).customLon).toBeUndefined();
  });

  it('음력이 아니면 윤달 표시는 꺼지고, 시를 모르면 분은 0이다', () => {
    expect(toBirthInput({ ...defaultForm(), calendar: 'solar', leap: true }).leap).toBe(false);
    expect(toBirthInput({ ...defaultForm(), calendar: 'lunar', leap: true }).leap).toBe(true);
    expect(toBirthInput({ ...defaultForm(), hour: null, minute: 45 }).minute).toBe(0);
  });
});
