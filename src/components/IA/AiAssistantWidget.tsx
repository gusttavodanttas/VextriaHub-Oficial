import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useAiAdvisor, AdvisorError, type ChatMessage } from '@/hooks/useAiAdvisor';
import { cn } from '@/lib/utils';
import { Sparkles, X, Send, RotateCw, Crown, ArrowRight, Brain } from 'lucide-react';

const GREETING =
  'Olá! 👋 Sou seu Conselheiro IA. Posso te dar um panorama do escritório, dizer o que priorizar, apontar riscos (prazos e audiências) e sugerir melhorias. Como posso ajudar?';
const SUGGESTIONS = ['Como está meu escritório?', 'O que priorizar hoje?', 'Tenho prazos ou audiências para me preocupar?'];

export const AiAssistantWidget: React.FC = () => {
  const navigate = useNavigate();
  const { hasIAModule } = usePlanFeatures();
  const advisor = useAiAdvisor();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open && hasIAModule && inputRef.current) inputRef.current.focus();
  }, [open, hasIAModule]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await advisor.chat(next);
      setMessages([...next, { role: 'assistant', content: res.reply || '…' }]);
    } catch (e) {
      const err = e as AdvisorError;
      const msg = err.code === 'openai-nao-configurada'
        ? 'A IA ainda não foi ativada pelo administrador do escritório. Assim que a chave for configurada, eu respondo. 🙂'
        : `Não consegui responder agora. ${err.message}`;
      setMessages([...next, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Conselheiro IA"
        className={cn(
          'fixed bottom-5 right-5 z-[60] h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-105',
          'bg-gradient-to-br from-primary to-violet-500 text-white',
          open && 'rotate-90'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {!open && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-[60] w-[min(400px,calc(100vw-2.5rem))] h-[min(620px,calc(100vh-8rem))] rounded-3xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 to-violet-500/10 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 text-white flex items-center justify-center shadow-md">
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm leading-tight">Conselheiro IA</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Assistente do seu escritório
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!hasIAModule ? (
            // Upsell premium
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Crown className="h-7 w-7" /></div>
              <div className="space-y-1.5">
                <p className="font-black text-lg">Conselheiro IA</p>
                <p className="text-sm text-muted-foreground">Um conselheiro com inteligência artificial que analisa seu escritório e te diz o que priorizar. Disponível no plano <span className="font-bold text-foreground">Premium</span>.</p>
              </div>
              <button onClick={() => { setOpen(false); navigate('/configuracoes'); }} className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                Ver planos <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Saudação */}
                <div className="flex gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white flex items-center justify-center shrink-0"><Sparkles className="h-3.5 w-3.5" /></div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]">{GREETING}</div>
                </div>

                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/25 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white flex items-center justify-center shrink-0"><Sparkles className="h-3.5 w-3.5" /></div>
                      <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap">{m.content}</div>
                    </div>
                  )
                ))}

                {loading && (
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white flex items-center justify-center shrink-0"><Sparkles className="h-3.5 w-3.5" /></div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-3 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border shrink-0">
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted/20 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/20">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    placeholder="Pergunte ao seu conselheiro…"
                    className="flex-1 resize-none bg-transparent text-sm outline-none max-h-28 py-1"
                  />
                  <button onClick={() => send(input)} disabled={loading || !input.trim()}
                    className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0">
                    {loading ? <RotateCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground/50 text-center mt-1.5">A IA pode errar. Confira informações importantes.</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
