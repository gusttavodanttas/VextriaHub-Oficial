// Extrai uma mensagem legível de um erro de tipo `unknown`, sem depender de `any`.
// Cobre Error, erros do Supabase/PostgREST ({ message }), strings soltas e o resto.
// Serve para tipar os blocos catch como `unknown` e ainda exibir um toast útil:
//   } catch (e: unknown) {
//     toast({ description: getErrorMessage(e, "Falha ao salvar.") });
//   }
export function getErrorMessage(e: unknown, fallback = "Ocorreu um erro inesperado."): string {
  if (typeof e === "string") return e.trim() || fallback;
  if (e instanceof Error) return e.message.trim() || fallback;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}
