import { LunarDate, SolarDate } from "./types";
/**
 * 将日期字符串 YYYY-MM-DD 或者一个 Date 对象分割为 [YYYY, M, D, H, m, s]
 * 当参数为字符串时分割符可以是 `-` `.` 或者 `/`
 *
 * @param dateStr 日期字符串或者 Date 对象
 * @returns [年, 月, 日]
 * @example
 * normalizeDateStr('2023-07-31'); // [2023, 7, 31]
 */
export declare const normalizeDateStr: (date: string | Date) => number[];
/**
 * 公历转农历，年份需要在【1900~2100】之间，并且日期必须在1900-1-31之后
 *
 * @param dateStr 公历日期 YYYY-MM-DD格式的字符串或者Date对象
 * @returns LunarDate
 */
export declare const solar2lunar: (dateStr: string | Date) => LunarDate;
/**
 * 农历转公历
 *
 * @param dateStr 农历日期 YYYY-MM-DD
 * @param isLeapMonth 是否闰月，若该月不是闰月，会忽略该参数
 * @returns SolarDate
 */
export declare const lunar2solar: (dateStr: string, isLeapMonth?: boolean) => SolarDate;
/**
 * [zamidusu patch] 음력 달력 공급자. 지정하면 solar2lunar·lunar2solar·getTotalDaysOfLunarMonth·음력 연 기준 연주가 공급자의 값을 쓴다.
 * 공급자가 null 을 돌려주는 날짜는 기본 계산(중국 표준시)으로 넘어간다. 계산이 끝나면 null 로 해제한다.
 */
export interface LunarProvider {
    toLunar(year: number, month: number, day: number): {
        lunarYear: number;
        lunarMonth: number;
        lunarDay: number;
        isLeap: boolean;
        monthDays: number;
    } | null;
    toSolar(lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean): {
        solarYear: number;
        solarMonth: number;
        solarDay: number;
    } | null;
}
export declare const setLunarProvider: (provider: LunarProvider | null) => void;
export declare const getLunarProvider: () => LunarProvider | null;
