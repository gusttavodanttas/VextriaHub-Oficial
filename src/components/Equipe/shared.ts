// Helpers e configs do módulo de Equipe — extraídos de pages/Equipe.tsx.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(seed: string) {
  const colors = [
    "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "–";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}
function genPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", user: "Usuário" };
const ROLE_CLS: Record<string, string> = {
  admin: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  user:  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
};
const STATUS_CLS: Record<string, string> = {
  pending:  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  expired:  "bg-slate-500/10 text-slate-500 border-slate-500/20",
};
const STATUS_LABEL: Record<string, string> = { pending: "Aguardando", accepted: "Aceito", expired: "Expirado" };

// ─── permission groups ────────────────────────────────────────────────────────

type PermItem = { key: string; label: string; defaultUser: boolean };
type PermGroup = { label: string; perms: PermItem[] };

const PERMISSION_GROUPS: PermGroup[] = [
  { label: "Clientes", perms: [
    { key: "canViewClients",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateClients", label: "Criar",       defaultUser: true  },
    { key: "canEditClients",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteClients", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Processos", perms: [
    { key: "canViewProcesses",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateProcesses", label: "Criar",       defaultUser: true  },
    { key: "canEditProcesses",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteProcesses", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Atendimentos", perms: [
    { key: "canViewAtendimentos",   label: "Visualizar", defaultUser: true  },
    { key: "canCreateAtendimentos", label: "Criar",       defaultUser: true  },
    { key: "canEditAtendimentos",   label: "Editar",      defaultUser: true  },
    { key: "canDeleteAtendimentos", label: "Excluir",     defaultUser: false },
  ]},
  { label: "Financeiro", perms: [
    { key: "canViewFinanceiro",   label: "Visualizar", defaultUser: true  },
    { key: "canManageFinanceiro", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Agenda & Audiências", perms: [
    { key: "canViewAgenda",       label: "Ver agenda",          defaultUser: true },
    { key: "canManageAgenda",     label: "Gerenciar agenda",    defaultUser: true },
    { key: "canViewAudiencias",   label: "Ver audiências",      defaultUser: true },
    { key: "canManageAudiencias", label: "Gerenciar audiências",defaultUser: true },
  ]},
  { label: "Tarefas & Prazos", perms: [
    { key: "canViewTarefas",   label: "Ver tarefas",      defaultUser: true },
    { key: "canManageTarefas", label: "Gerenciar tarefas",defaultUser: true },
    { key: "canViewPrazos",    label: "Ver prazos",       defaultUser: true },
    { key: "canManagePrazos",  label: "Gerenciar prazos", defaultUser: true },
  ]},
  { label: "Consultivo", perms: [
    { key: "canViewConsultivo",   label: "Visualizar", defaultUser: true  },
    { key: "canManageConsultivo", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Relatórios", perms: [
    { key: "canViewGraficos",          label: "Ver gráficos",        defaultUser: true  },
    { key: "canViewAdvancedAnalytics", label: "Analytics avançados", defaultUser: false },
  ]},
  { label: "Metas", perms: [
    { key: "canViewMetas",   label: "Visualizar", defaultUser: true  },
    { key: "canManageMetas", label: "Gerenciar",  defaultUser: false },
  ]},
  { label: "Equipe & Escritório", perms: [
    { key: "canViewEquipe",   label: "Ver equipe",       defaultUser: true  },
    { key: "canManageEquipe", label: "Gerenciar equipe", defaultUser: false },
    { key: "canInviteUsers",  label: "Convidar membros", defaultUser: false },
  ]},
];

export { getInitials, avatarColor, fmtDate, genPassword, ROLE_LABEL, ROLE_CLS, STATUS_CLS, STATUS_LABEL, PERMISSION_GROUPS };
export type { PermItem, PermGroup };
