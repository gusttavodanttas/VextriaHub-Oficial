import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, UserPlus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { onlyDigits } from "@/lib/document";
import { NovoClienteDialog } from "@/components/Clientes/NovoClienteDialog";

interface ClientSelectProps {
  value: string; // client_id
  onValueChange: (value: string, name: string) => void;
  placeholder?: string;
}

// Dropdown INLINE (sem Radix Popover/portal) para funcionar dentro de Dialogs —
// portais ficam fora do dialog e o focus-trap/pointer-events bloqueia digitar/rolar.
export const ClientSelect: React.FC<ClientSelectProps> = ({ value, onValueChange, placeholder = "Selecionar cliente..." }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string, nome: string }[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchClients = useCallback(async () => {
    if (!user?.office_id) return;
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('office_id', user.office_id)
      .eq('deletado', false)
      .order('nome');
    if (!error) setClients(data || []);
  }, [user?.office_id]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Fecha ao clicar fora / ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // foca o campo de busca ao abrir
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selectedClient = clients.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter((c) => c.nome.toLowerCase().includes(q));
  }, [clients, query]);

  const pick = (id: string, nome: string) => { onValueChange(id, nome); setOpen(false); setQuery(''); };

  // Cadastra um novo cliente na hora e já seleciona
  const handleCreate = async (c: any): Promise<boolean> => {
    if (!user?.office_id) return false;
    const payload = {
      nome: c.name, email: c.email || null, telefone: c.phone || null,
      cpf_cnpj: onlyDigits(c.cpfCnpj) || null, tipo_pessoa: c.tipoPessoa,
      origem: c.origem || null, endereco: c.endereco || null,
      status: c.status || 'Ativo', data_aniversario: c.dataAniversario || null,
      user_id: user.id, office_id: user.office_id,
    };
    const { data: created, error } = await supabase.from('clientes').insert(payload).select('id, nome').single();
    if (error || !created) {
      toast({ title: "Erro ao cadastrar cliente", description: error?.message, variant: "destructive" });
      return false;
    }
    await fetchClients();
    onValueChange(created.id, created.nome);
    toast({ title: "Cliente cadastrado", description: `${created.nome} vinculado.` });
    return true;
  };

  return (
    <>
      <div className="relative" ref={rootRef}>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="w-full justify-between rounded-xl font-normal">
          <span className={cn("truncate", !selectedClient && "text-muted-foreground")}>{selectedClient ? selectedClient.nome : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filtered.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => pick(client.id, client.nome)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === client.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{client.nome}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground/60">Nenhum cliente encontrado.</p>
              )}
              <button
                type="button"
                onClick={() => { setOpen(false); setCreateOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10 transition-colors border-t border-border mt-1"
              >
                <UserPlus className="h-4 w-4 shrink-0" /> Cadastrar novo cliente
              </button>
            </div>
          </div>
        )}
      </div>

      <NovoClienteDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
    </>
  );
};
