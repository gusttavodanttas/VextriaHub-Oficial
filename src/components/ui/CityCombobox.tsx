import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface City { label: string; }

// Cache em memória — busca a lista do IBGE só uma vez por sessão.
let CITY_CACHE: City[] | null = null;
let CITY_PROMISE: Promise<City[]> | null = null;

async function loadCities(): Promise<City[]> {
  if (CITY_CACHE) return CITY_CACHE;
  if (CITY_PROMISE) return CITY_PROMISE;
  CITY_PROMISE = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome")
    .then((r) => r.json())
    .then((arr: any[]) =>
      arr.map((m) => {
        const uf = m?.microrregiao?.mesorregiao?.UF?.sigla || m?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla || "";
        return { label: uf ? `${m.nome} - ${uf}` : m.nome };
      })
    )
    .then((list) => { CITY_CACHE = list; return list; })
    .catch(() => { CITY_PROMISE = null; return []; });
  return CITY_PROMISE;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function CityCombobox({ value, onChange, placeholder = "Digite a cidade…" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[]>(CITY_CACHE || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && cities.length === 0) {
      setLoading(true);
      loadCities().then((list) => { setCities(list); setLoading(false); });
    }
  }, [open, cities.length]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, 30);
    return cities.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 40);
  }, [query, cities]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left font-black text-foreground bg-transparent"
        >
          <span className={cn("flex-1 truncate", !value && "text-muted-foreground/50 font-bold")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-40 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 rounded-2xl w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar cidade…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando cidades…
              </div>
            )}
            {!loading && results.length === 0 && <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>}
            {!loading && (
              <CommandGroup>
                {results.map((c) => (
                  <CommandItem
                    key={c.label}
                    value={c.label}
                    onSelect={() => { onChange(c.label); setOpen(false); setQuery(""); }}
                    className="rounded-xl font-medium"
                  >
                    <MapPin className="h-3.5 w-3.5 mr-2 text-primary/60" />
                    {c.label}
                    {value === c.label && <Check className="h-4 w-4 ml-auto text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
