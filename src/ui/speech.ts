// 음성 읽기(F-10): 브라우저의 Web Speech API 를 쓴다. 지원하지 않으면 버튼을 숨긴다.

export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** 긴 글을 문장 단위로 잘라 한 번에 너무 길게 읽지 않게 한다 */
export const chunkText = (text: string, max = 160): string[] => {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?。]+[.!?。]?/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

export const stopSpeech = (): void => {
  if (speechSupported()) window.speechSynthesis.cancel();
};

export interface SpeakHandlers {
  onEnd?: () => void;
  /** 재생을 시작하지 못했을 때(브라우저에 음성이 없거나 차단됨) */
  onError?: (reason: string) => void;
}

export const speak = (text: string, handlers: SpeakHandlers = {}): void => {
  if (!speechSupported()) {
    handlers.onError?.('unsupported');
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = chunkText(text);
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('ko'));
  let failed = false;
  chunks.forEach((c, i) => {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = 'ko-KR';
    if (voice) u.voice = voice;
    u.rate = 1;
    u.onerror = (e) => {
      // 사용자가 멈춤을 눌러 cancel() 한 경우는 오류가 아니다
      if (e.error === 'interrupted' || e.error === 'canceled' || failed) return;
      failed = true;
      synth.cancel();
      handlers.onError?.(e.error);
    };
    if (i === chunks.length - 1) u.onend = () => handlers.onEnd?.();
    synth.speak(u);
  });
};
