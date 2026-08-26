import { useRef, useState, useCallback, useEffect } from 'react';

// Voz nativa do navegador: reconhecimento (fala → texto) + síntese (texto → fala),
// em pt-BR. Sem backend e sem custo. STT depende de suporte do navegador
// (Chrome/Edge OK); TTS é amplamente suportado. Exige HTTPS (prod é https).

// Tira marcação de markdown pra leitura em voz sair natural.
export function stripMarkdown(text: string): string {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useSpeech() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  const sttSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const startListening = useCallback((onFinal: (text: string) => void) => {
    if (!sttSupported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    try {
      const rec = new SR();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const t = e?.results?.[0]?.[0]?.transcript?.trim();
        if (t) onFinal(t);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }, [sttSupported]);

  const speak = useCallback((text: string) => {
    if (!ttsSupported) return;
    const clean = stripMarkdown(text);
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'pt-BR';
      const voices = window.speechSynthesis.getVoices();
      const pt = voices.find((v) => v.lang?.toLowerCase().startsWith('pt-br')) || voices.find((v) => v.lang?.toLowerCase().startsWith('pt'));
      if (pt) u.voice = pt;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [ttsSupported]);

  const cancelSpeak = useCallback(() => {
    if (ttsSupported) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
  }, [ttsSupported]);

  // Pré-carrega as vozes (alguns navegadores só populam após 'voiceschanged').
  useEffect(() => {
    if (ttsSupported) { try { window.speechSynthesis.getVoices(); } catch { /* ignore */ } }
  }, [ttsSupported]);

  return { sttSupported, ttsSupported, listening, startListening, stopListening, speak, cancelSpeak };
}
