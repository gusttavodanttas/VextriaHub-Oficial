import React, { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export const ClientSelect: React.FC<ClientSelectProps> = ({ value, onValueChange, placeholder = "Selecionar cliente..." }) => {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string, nome: string }[]>([]);
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

  const selectedClient = clients.find((client) => client.id === value);

  // Cadastra um novo cliente na hora e já seleciona
  const handleCreate = async (c: any): Promise<boolean> => {
    if (!user?.office_id) return false;
    const payload = {
      nome: c.name,
      email: c.email || null,
      telefone: c.phone || null,
      cpf_cnpj: onlyDigits(c.cpfCnpj) || null,
      tipo_pessoa: c.tipoPessoa,
      origem: c.origem || null,
      endereco: c.endereco || null,
      status: c.status || 'Ativo',
      data_aniversario: c.dataAniversario || null,
      user_id: user.id,
      office_id: user.office_id,
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
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between rounded-xl">
            <span className="truncate">{selectedClient ? selectedClient.nome : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 pointer-events-auto" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>
                <button type="button" onClick={() => { setOpen(false); setCreateOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-primary hover:underline">
                  <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
                </button>
              </CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.nome}
                    onSelect={() => { onValueChange(client.id, client.nome); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === client.id ? "opacity-100" : "opacity-0")} />
                    {client.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem value="__novo__" onSelect={() => { setOpen(false); setCreateOpen(true); }} className="text-primary font-bold">
                  <UserPlus className="mr-2 h-4 w-4" /> Cadastrar novo cliente
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <NovoClienteDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreate} />
    </>
  );
};
