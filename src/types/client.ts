export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cases: number;
  status: string;
  lastContact: string;
  cpfCnpj: string;
  tipoPessoa: "fisica" | "juridica";
  origem: string;
  endereco: string;
  dataAniversario: string;
  createdAt: string;
}

export interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  tipoPessoa: "fisica" | "juridica";
  origem: string;
  endereco: string;
  dataAniversario: string;
}

export interface ClientFilters {
  search: string;
  status: string;
  tipoPessoa: string;
  origem: string;
}