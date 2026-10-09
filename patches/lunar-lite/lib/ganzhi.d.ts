import { HeavenlyStemAndEarthlyBranchDate, Options } from "./types";
/**
 * 通过农历获取生辰干支
 *
 * @param dateStr 农历日期 YYYY-MM-DD
 * @param timeIndex 时辰索引【0～12】
 * @param isLeap 是否为闰月
 * @returns HeavenlyStemAndEarthlyBranchResult
 */
export declare const getHeavenlyStemAndEarthlyBranchByLunarDate: (dateStr: string, timeIndex: number, isLeap?: boolean, options?: Options) => HeavenlyStemAndEarthlyBranchDate;
/**
 * 将阳历转化为干支纪年
 *
 * @param dateStr 公历日期 YYYY-MM-DD
 * @param timeIndex 时辰索引【0～12】
 * @returns HeavenlyStemAndEarthlyBranchResult
 */
export declare const getHeavenlyStemAndEarthlyBranchBySolarDate: (dateStr: string | Date, timeIndex: number, options?: Options) => HeavenlyStemAndEarthlyBranchDate;
/**
 * [zamidusu patch] 출생 순간 기준 연주 덮어쓰기. 입춘 기준 연주를 '날짜'가 아니라 실제 출생 순간으로 정확히 정하고 싶을 때,
 * 계산 직전에 지정하고 끝나면 null 로 해제한다. 해당 양력 날짜에 대해서만, 연주 기준이 'normal' 이 아닐 때 적용된다.
 */
export declare const setBirthYearOverride: (override: {
    year: number;
    month: number;
    date: number;
    gan: string;
    zhi: string;
} | null) => void;
