"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBirthYearOverride = exports.getHeavenlyStemAndEarthlyBranchBySolarDate = exports.getHeavenlyStemAndEarthlyBranchByLunarDate = void 0;
var constants_1 = require("./constants");
var convertor_1 = require("./convertor");
var lunar_typescript_1 = require("lunar-typescript");
var utils_1 = require("./utils");
/**
 * 通过农历获取生辰干支
 *
 * @param dateStr 农历日期 YYYY-MM-DD
 * @param timeIndex 时辰索引【0～12】
 * @param isLeap 是否为闰月
 * @returns HeavenlyStemAndEarthlyBranchResult
 */
var getHeavenlyStemAndEarthlyBranchByLunarDate = function (dateStr, timeIndex, isLeap, options) {
    if (options === void 0) { options = { year: "normal", month: "exact" }; }
    var solarDate = (0, convertor_1.lunar2solar)(dateStr, isLeap);
    return (0, exports.getHeavenlyStemAndEarthlyBranchBySolarDate)(solarDate.toString(), timeIndex, options);
};
exports.getHeavenlyStemAndEarthlyBranchByLunarDate = getHeavenlyStemAndEarthlyBranchByLunarDate;
/**
 * [zamidusu patch] 출생 순간 기준 연주 덮어쓰기.
 *
 * 입춘 기준(year !== 'normal')의 연주는 원래 '날짜' 단위로만 판정되어, 입춘 당일에는 절입 시각 전이어도
 * 새해로 본다. 호출하는 쪽이 실제 출생 순간으로 정확히 구한 연주를 이 날짜에 한해 대신 쓰게 한다.
 * 계산을 시작하기 직전에 지정하고, 끝나면 반드시 null 로 되돌려야 한다.
 *
 * @param override { year, month, date, gan, zhi } 또는 null(해제)
 */
var birthYearOverride = null;
var setBirthYearOverride = function (override) {
    birthYearOverride = override;
};
exports.setBirthYearOverride = setBirthYearOverride;
/**
 * [zamidusu patch] 달력 공급자(convertor.setLunarProvider)가 준 음력 값을, 월주 계산(calculateMonthlyGanZhi)이
 * 읽는 lunar 객체 모양으로 감싼다. 절기 기준 월간지는 달력과 무관하므로 원래 객체에 맡긴다.
 */
var lunarLikeOf = function (provided, lunar) {
    return {
        getMonth: function () { return provided.isLeap ? 0 - provided.lunarMonth : provided.lunarMonth; },
        getDay: function () { return provided.lunarDay; },
        getMonthGanExact: function () { return lunar.getMonthGanExact(); },
        getMonthZhiExact: function () { return lunar.getMonthZhiExact(); },
    };
};
/**
 * 将阳历转化为干支纪年
 *
 * @param dateStr 公历日期 YYYY-MM-DD
 * @param timeIndex 时辰索引【0～12】
 * @returns HeavenlyStemAndEarthlyBranchResult
 */
var getHeavenlyStemAndEarthlyBranchBySolarDate = function (dateStr, timeIndex, options) {
    if (options === void 0) { options = { year: "exact" }; }
    var _a = (0, convertor_1.normalizeDateStr)(dateStr), year = _a[0], month = _a[1], date = _a[2];
    var solar = lunar_typescript_1.Solar.fromYmdHms(year, month, date, Math.max(timeIndex * 2 - 1, 0), 30, 0);
    var lunar = solar.getLunar();
    var provider = (0, convertor_1.getLunarProvider)();
    var provided = provider ? provider.toLunar(year, month, date) : null;
    var yearlyGan = (options === null || options === void 0 ? void 0 : options.year) === "normal"
        ? (provided ? constants_1.HEAVENLY_STEMS[(0, utils_1.fixIndex)(provided.lunarYear - 4, 10)] : lunar.getYearGan())
        : lunar.getYearGanByLiChun();
    var yearlyZhi = (options === null || options === void 0 ? void 0 : options.year) === "normal"
        ? (provided ? constants_1.EARTHLY_BRANCHES[(0, utils_1.fixIndex)(provided.lunarYear - 4, 12)] : lunar.getYearZhi())
        : lunar.getYearZhiByLiChun();
    if (birthYearOverride &&
        (options === null || options === void 0 ? void 0 : options.year) !== "normal" &&
        birthYearOverride.year === year &&
        birthYearOverride.month === month &&
        birthYearOverride.date === date) {
        yearlyGan = birthYearOverride.gan;
        yearlyZhi = birthYearOverride.zhi;
    }
    var yearly = [
        yearlyGan,
        yearlyZhi,
    ];
    // 如果是初一换干支的话需要自己起五虎遁
    var monthly = calculateMonthlyGanZhi(yearlyGan, provided ? lunarLikeOf(provided, lunar) : lunar, options === null || options === void 0 ? void 0 : options.month);
    var daily = [
        lunar.getDayGanExact(),
        lunar.getDayZhiExact(),
    ];
    var hourly = [
        lunar.getTimeGan(),
        lunar.getTimeZhi(),
    ];
    return {
        yearly: yearly,
        monthly: monthly,
        daily: daily,
        hourly: hourly,
        toString: function () {
            return "".concat(yearly.join(""), " ").concat(monthly.join(""), " ").concat(daily.join(""), " ").concat(hourly.join(""));
        },
    };
};
exports.getHeavenlyStemAndEarthlyBranchBySolarDate = getHeavenlyStemAndEarthlyBranchBySolarDate;
function calculateMonthlyGanZhi(yearlyGan, lunar, monthlyDivide) {
    if (monthlyDivide === void 0) { monthlyDivide = "exact"; }
    if (monthlyDivide === "exact") {
        // 按节气
        return [
            lunar.getMonthGanExact(),
            lunar.getMonthZhiExact(),
        ];
    }
    // 按初一
    var fixLeap = lunar.getMonth() < 0 && lunar.getDay() > 15 ? 1 : 0;
    var gan = constants_1.HEAVENLY_STEMS[(0, utils_1.fixIndex)(constants_1.HEAVENLY_STEMS.indexOf(constants_1.FIVE_TIGER[constants_1.HEAVENLY_STEMS.indexOf(yearlyGan)]) +
        Math.abs(lunar.getMonth()) -
        1 +
        fixLeap, 10)];
    var zhi = constants_1.MONTHLY_EARTHLY_BRANCHES[Math.abs(lunar.getMonth()) - 1 + fixLeap];
    return [gan, zhi];
}
