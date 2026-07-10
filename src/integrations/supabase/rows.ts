// Atalhos ergonômicos sobre os tipos gerados do Supabase (types.ts).
// Usar estes em vez de `any` nos payloads de insert/update faz o TypeScript
// PEGAR nome de coluna errado, tipo trocado ou campo obrigatório faltando —
// exatamente a classe de bug que já corrigimos à mão (office_id, status, etc.).
//
//   TablesInsert<'audiencias'>  → shape aceito por .insert()
//   TablesUpdate<'prazos'>      → shape aceito por .update()
//   Tables<'clientes'>          → shape de uma linha lida
import type { Database } from "./types";

type PublicSchema = Database["public"];
export type TableName = keyof PublicSchema["Tables"];

export type Tables<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = PublicSchema["Tables"][T]["Update"];
