// useSpeech: reconhecimento (fala → texto) com erros explicados por toast e
// síntese (texto → fala) em pt-BR sem markdown.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { useSpeech, stripMarkdown } from '@/hooks/useSpeech';

type Rec = { lang?: string; start: () => void; stop: () => void; onresult?: (e: unknown) => void; onend?: () => void; onerror?: (e: unknown) => void };
let ultimaRec: Rec | null = null;
class FakeRecognition { start = vi.fn(); stop = vi.fn(); constructor() { ultimaRec = this as unknown as Rec; } }
class FakeUtterance { text: string; lang = ''; rate = 1; voice: unknown = null; constructor(t: string) { this.text = t; } }
const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => [{ lang: 'en-US' }, { lang: 'pt-BR', name: 'Luciana' }]) };
const w = window as unknown as Record<string, unknown>;

describe('stripMarkdown', () => {
  it('remove negrito, marcadores, cabeçalhos e quebras duplas', () => {
    expect(stripMarkdown('# Título\n\n**Importante**: _x_\n- item `a`\n- item b\n\n> fim')).toBe('Título. Importante: x item a item b. fim');
    expect(stripMarkdown('')).toBe('');
  });
});

describe('useSpeech', () => {
  beforeEach(() => {
    mockToast.mockClear(); captureError.mockClear(); ultimaRec = null;
    w.webkitSpeechRecognition = FakeRecognition; w.speechSynthesis = synth; w.SpeechSynthesisUtterance = FakeUtterance;
    synth.cancel.mockClear(); synth.speak.mockClear();
  });
  afterEach(() => { delete w.webkitSpeechRecognition; delete w.SpeechRecognition; delete w.speechSynthesis; delete w.SpeechSynthesisUtterance; });

  it('startListening configura pt-BR, entrega o texto final e para ao terminar', () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeech());
    expect(result.current.sttSupported).toBe(true);
    act(() => { result.current.startListening(onFinal); });
    expect(result.current.listening).toBe(true);
    expect(ultimaRec?.lang).toBe('pt-BR');
    expect(ultimaRec?.start).toHaveBeenCalled();
    act(() => { ultimaRec!.onresult!({ results: [[{ transcript: '  marcar reunião ' }]] }); });
    expect(onFinal).toHaveBeenCalledWith('marcar reunião');
    act(() => { ultimaRec!.onresult!({ results: [[{ transcript: '' }]] }); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    act(() => { ultimaRec!.onend!(); });
    expect(result.current.listening).toBe(false);
    act(() => { result.current.startListening(onFinal); });
    act(() => { result.current.stopListening(); });
    expect(ultimaRec?.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('erros do reconhecimento: mic negado explica; no-speech/aborted ficam em silêncio', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => { result.current.startListening(vi.fn()); });
    act(() => { ultimaRec!.onerror!({ error: 'not-allowed' }); });
    expect(result.current.listening).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não deu pra ouvir', description: 'Permita o acesso ao microfone nas configurações do navegador.' }));
    mockToast.mockClear();
    act(() => { result.current.startListening(vi.fn()); });
    act(() => { ultimaRec!.onerror!({ error: 'no-speech' }); });
    act(() => { ultimaRec!.onerror!({ error: 'aborted' }); });
    expect(mockToast).not.toHaveBeenCalled();
    act(() => { ultimaRec!.onerror!({ error: 'desconhecido' }); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Erro no reconhecimento de voz.' }));
  });

  it('construtor que explode → Sentry + toast; sem suporte não faz nada', () => {
    w.webkitSpeechRecognition = class { constructor() { throw new Error('nope'); } };
    const { result } = renderHook(() => useSpeech());
    act(() => { result.current.startListening(vi.fn()); });
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(result.current.listening).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não deu pra ouvir' }));

    delete w.webkitSpeechRecognition; delete w.speechSynthesis;
    const { result: r2 } = renderHook(() => useSpeech());
    expect(r2.current.sttSupported).toBe(false);
    expect(r2.current.ttsSupported).toBe(false);
    act(() => { r2.current.startListening(vi.fn()); r2.current.speak('x'); r2.current.cancelSpeak(); });
    expect(r2.current.listening).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('speak limpa o markdown, escolhe a voz pt-BR e cancela a fala anterior; texto vazio não fala', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => { result.current.speak('**Olá** advogado'); });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u).toMatchObject({ text: 'Olá advogado', lang: 'pt-BR', rate: 1.05, voice: { lang: 'pt-BR', name: 'Luciana' } });
    act(() => { result.current.speak('***'); });
    expect(synth.speak).toHaveBeenCalledTimes(1);
    act(() => { result.current.cancelSpeak(); });
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
});
