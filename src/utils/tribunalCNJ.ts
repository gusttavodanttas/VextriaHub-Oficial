// Deriva a sigla do tribunal a partir do número único CNJ.
// Formato: NNNNNNN-DD.AAAA.J.TR.OOOO  → J = justiça, TR = tribunal.
const UF_MAP: Record<string, string> = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE",
  "07": "DF", "08": "ES", "09": "GO", "10": "MA", "11": "MT", "12": "MS",
  "13": "MG", "14": "PA", "15": "PB", "16": "PR", "17": "PE", "18": "PI",
  "19": "RJ", "20": "RN", "21": "RS", "22": "RO", "23": "RR", "24": "SC",
  "25": "SE", "26": "SP", "27": "TO",
};

export function tribunalFromCNJ(numero?: string): string {
  const d = (numero || "").replace(/\D/g, "");
  if (d.length < 16) return "";
  const j = d[13];
  const tr = d.substring(14, 16);
  const trN = parseInt(tr, 10);
  switch (j) {
    case "1": return "STF";
    case "3": return "STJ";
    case "4": return `TRF${trN}`;                       // Justiça Federal
    case "5": return tr === "00" ? "TST" : `TRT${trN}`; // Justiça do Trabalho
    case "6": return tr === "00" ? "TSE" : `TRE-${UF_MAP[tr] || tr}`; // Eleitoral
    case "7": return "STM";
    case "8": {                                         // Justiça Estadual
      const uf = UF_MAP[tr];
      return uf === "DF" ? "TJDFT" : uf ? `TJ${uf}` : "TJ";
    }
    case "9": {                                         // Justiça Militar Estadual
      const uf = UF_MAP[tr];
      return uf ? `TJM-${uf}` : "TJM";
    }
    default: return "";
  }
}
