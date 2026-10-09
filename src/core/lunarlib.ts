import lib from 'lunar-javascript';

// CJS 패키지라 기본 가져오기로 받아 구조 분해한다(Vite 빌드·vitest 모두 동작).
export const Solar: any = (lib as any).Solar;
export const Lunar: any = (lib as any).Lunar;
export const LunarUtil: any = (lib as any).LunarUtil;
