# 의존성 패치

`npm install` 직후(`postinstall`) `scripts/apply-patches.mjs` 가 `node_modules` 의 파일을 이 폴더의 수정본으로 덮어씁니다.

## 대상: `lunar-lite@0.2.8` (명반 엔진 iztro 가 날짜·간지를 구하는 데 쓰는 라이브러리)

| 파일 | 바꾼 이유 |
|---|---|
| `lib/ganzhi.js` `lib/ganzhi.d.ts` | ① **입춘 기준 연주** — iztro 의 “입춘 기준”은 연주를 **날짜 단위**로만 판정해, 입춘 당일에는 절입 시각 전에 태어나도 새해로 계산합니다(예: 2024-02-04 17:00 한국 시각은 입춘 17:27 전이라 癸卯년인데 甲辰년으로). 호출하는 쪽이 출생 순간으로 정확히 정한 연주를 그 날짜에 한해 대신 쓰게 하는 `setBirthYearOverride` 를 추가했습니다. ② 달력 공급자가 있으면 **음력 연 기준 연주**와 **음력 월 기준 월주**가 그 값을 쓰게 했습니다. |
| `lib/convertor.js` `lib/convertor.d.ts` | **음력 달력 공급자** `setLunarProvider` — 기본 계산은 음력을 중국 표준시(UTC+8) 날짜로 세므로 한국 음력과 1900~2050년 중 3.59%(1,978일)의 날짜가 다릅니다(2012년 한국은 윤3월·중국은 윤4월 등, I-15). 공급자를 끼우면 `solar2lunar`·`lunar2solar` 가 한국 음력 표(`src/core/lunarkr.ts`)를 씁니다. 표 밖 날짜는 기본 계산으로 넘어갑니다. |
| `lib/misc.js` | `getTotalDaysOfLunarMonth` 가 공급자의 달 길이를 쓰게 했습니다. |

사용처는 모두 `src/core/chart.ts` 이고, **계산하는 동안만** 지정했다가 `finally` 로 해제합니다(누수·예외 후 해제는 `tests/yearbasis.test.ts`, `tests/lunarkr.test.ts` 가 확인).

- 바뀐 내용: [`lunar-lite-0.2.8.diff`](lunar-lite-0.2.8.diff) (읽기용. 실제로 쓰는 것은 `lunar-lite/` 의 전체 파일)
- 안전장치: 설치된 파일의 SHA-256 이 `manifest.json` 의 `original` 일 때만 덮어씁니다. 버전이 달라졌거나 직접 고친 파일이 하나라도 있으면 **아무것도 쓰지 않고 설치를 멈춥니다**.
- 패치가 빠진 설치(`--ignore-scripts`)는 `npm run typecheck`·`npm test` 가 바로 실패합니다(`setBirthYearOverride`·`setLunarProvider` 없음).
- 의존성을 올릴 때: 새 버전의 같은 파일에 같은 수정을 다시 하고(`diff -u` 로 확인), `manifest.json` 의 해시를 갱신하세요. 업스트림이 고치면 이 패치는 지워도 됩니다.

## 한국 음력 표 만들기

`src/core/lunarkr-data.ts` 는 `node scripts/gen-lunar-kr.mjs` 로 만든 자동 생성 파일입니다(천문 계산: `scripts/lunar-kr-generator.mjs`).
규칙과 검증 결과는 `tests/lunarkr.test.ts` 에 있습니다 — 한국천문연구원 자료 기반 라이브러리(`korean-lunar-calendar`, 개발 전용)와 1900-02-01~2050-12-31 의 55,121일이 모두 같습니다.
