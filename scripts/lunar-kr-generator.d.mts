// lunar-kr-generator.mjs 의 타입(테스트에서 가져다 쓰기 위한 선언)
export const DAY_MS: number;
export const chineseOffset: () => number;
export const koreanOffset: (utcMs: number) => number;
export const epochDay: (y: number, m: number, d: number) => number;
export const fromEpochDay: (n: number) => { y: number; m: number; d: number };
export interface CalMonth { year: number; num: number; leap: boolean; start: number; days: number }
export interface Calendar { months: (CalMonth | null)[]; monthOfDay: (day: number) => number }
export function buildCalendar(offsetOf: (utcMs: number) => number, fromYear: number, toYear: number): Calendar;
export function lunarOfDay(cal: Calendar, day: number): { year: number; month: number; leap: boolean; day: number; monthDays: number } | null;
export interface YearInfo { year: number; newYear: number; leap: number; lengths: number[] }
export function yearInfos(cal: Calendar, fromYear: number, toYear: number): YearInfo[];
export function encodeYear(info: YearInfo): number;
export function renderDataModule(infos: YearInfo[], meta: { first: number; last: number; firstSolar: string; lastSolar: string }): string;
