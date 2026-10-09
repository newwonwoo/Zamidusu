# 의존성 패치

`npm install` 직후(`postinstall`) `scripts/apply-patches.mjs` 가 `node_modules` 의 파일을 이 폴더의 수정본으로 덮어씁니다.

| 대상 | 이유 |
|---|---|
| `lunar-lite@0.2.8` `lib/ganzhi.js`, `lib/ganzhi.d.ts` | 명반 엔진(iztro)의 “입춘 기준” 연주가 **날짜 단위**로만 판정되어, 입춘 당일에는 절입 시각 전에 태어나도 새해로 계산됩니다(예: 2024-02-04 17:00 한국 시각은 입춘 17:27 전이라 癸卯년인데 甲辰년으로). 호출하는 쪽이 출생 순간으로 정확히 정한 연주를 그 날짜에 한해 대신 쓰게 하는 `setBirthYearOverride` 를 추가했습니다. 사용처: `src/core/chart.ts` |

- 바뀐 내용: [`lunar-lite-0.2.8.diff`](lunar-lite-0.2.8.diff) (읽기용. 실제로 쓰는 것은 `lunar-lite/` 의 전체 파일)
- 안전장치: 설치된 파일의 SHA-256 이 `manifest.json` 의 `original` 일 때만 덮어씁니다. 버전이 달라졌거나 직접 고친 파일이면 **설치를 멈추고** 알려 줍니다.
- 패치가 빠진 설치(`--ignore-scripts`)는 `npm run typecheck`·`npm test` 가 바로 실패합니다(`setBirthYearOverride` 없음).
- 의존성을 올릴 때: 새 버전의 `lib/ganzhi.js` 에 같은 수정을 다시 하고(`diff -u` 로 확인), `manifest.json` 의 해시를 갱신하세요. 업스트림이 연주를 순간 단위로 고치면 이 패치는 지워도 됩니다(`tests/yearbasis.test.ts` 가 알려 줍니다).
