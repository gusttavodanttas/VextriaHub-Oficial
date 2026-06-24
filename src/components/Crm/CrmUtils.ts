export const getStatusColor = (status: string) => {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "quente": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "morno": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
    case "frio": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "convertido": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default: return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }
};

