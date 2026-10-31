import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { captureError } from '@/lib/monitoring';
import { X } from 'lucide-react';

interface Opcao { id: string; label: string; sub?: string }

/**
 * Busca e escolhe um cliente (nome, CPF/CNPJ, telefone) ou processo (título,
 * número CNJ) do escritório. Busca no servidor com debounce, sem carregar a base.
 */
export function VinculoPicker({
  tipo, valorId, valorLabel, onChange, placeholder,
}: {
  tipo: 'cliente' | 'processo';
  valorId: string | null;
  valorLabel?: string | null;
  onChange: (id: string | null, label: string | null) => void;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [ops, setOps] = useState<Opcao[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || !user?.office_id) { setOps([]); return; }
    const oid = user.office_id;
    const wild = `%${term}%`;
    const digits = term.replace(/\D/g, '');
    const wildDigits = digits.length >= 6 ? `%${digits.split('').join('%')}%` : null;
    const t = setTimeout(async () => {
      try {
        if (tipo === 'cliente') {
          const [a, b] = await Promise.all([
            supabase.from('clientes').select('id, nome, cpf_cnpj, telefone').eq('office_id', oid).eq('deletado', false).ilike('nome', wild).limit(8),
            wildDigits
              ? supabase.from('clientes').select('id, nome, cpf_cnpj, telefone').eq('office_id', oid).eq('deletado', false).ilike('cpf_cnpj', wildDigits).limit(5)
              : Promise.resolve({ data: [], error: null }),
          ]);
          if (a.error) throw a.error;
          const vistos = new Set<string>();
          setOps([...(b.data || []), ...(a.data || [])]
            .filter(r => (vistos.has(r.id) ? false : (vistos.add(r.id), true)))
            .map(r => ({ id: r.id, label: r.nome, sub: [r.cpf_cnpj, r.telefone].filter(Boolean).join(' · ') || undefined })));
        } else {
          const [a, b] = await Promise.all([
            supabase.from('processos').select('id, titulo, numero_processo').eq('office_id', oid).eq('deletado', false).ilike('titulo', wild).limit(8),
            supabase.from('processos').select('id, titulo, numero_processo').eq('office_id', oid).eq('deletado', false).ilike('numero_processo', wildDigits ?? wild).limit(5),
          ]);
          if (a.error) throw a.error;
          const vistos = new Set<string>();
          setOps([...(b.data || []), ...(a.data || [])]
            .filter(r => (vistos.has(r.id) ? false : (vistos.add(r.id), true)))
            .map(r => ({ id: r.id, label: r.titulo, sub: r.numero_processo || undefined })));
        }
      } catch (e) {
        captureError(e, { scope: 'VinculoPicker', tipo });
        setOps([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, tipo, user?.office_id]);

  if (valorId) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span className="truncate font-medium">{valorLabel || 'Vinculado'}</span>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remover vínculo" onClick={() => onChange(null, null)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={e => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder ?? (tipo === 'cliente' ? 'Buscar cliente por nome ou CPF…' : 'Buscar processo por título ou CNJ…')}
      />
      {aberto && ops.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {ops.map(o => (
            <button
              key={o.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(o.id, o.label); setQ(''); setAberto(false); }}
            >
              <div className="font-medium truncate">{o.label}</div>
              {o.sub && <div className="text-xs text-muted-foreground truncate">{o.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
