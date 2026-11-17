// Formatação brasileira: R$ 1.234,56, dd/mm/aaaa e fuso de São Paulo
const FUSO = 'America/Sao_Paulo';
const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

export const moeda = (v) => fmtMoeda.format(Number(v) || 0);
export const numero = (v) => fmtNumero.format(Number(v) || 0);
// 40 -> "40%", 37.5 -> "37,5%"
export const percentual = (v) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(v) || 0)}%`;
export const data = (d) => (d ? fmtData.format(new Date(d)) : '');
export const dataHora = (d) => (d ? `${fmtData.format(new Date(d))} ${fmtHora.format(new Date(d))}` : '');

// Converte o que a pessoa digitou ("1.234,56", "1234,5", "1234.56", "1234") em número.
// Devolve null quando o campo está vazio ou inválido.
export function paraNumero(texto) {
  let t = String(texto ?? '').trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');   // vírgula é o decimal
  else if (!/^\d+\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '');      // ponto era separador de milhar
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Número -> texto para preencher um campo de edição ("1234,56")
export const paraCampo = (n) => (n === null || n === undefined || n === '' ? '' : String(Number(n)).replace('.', ','));

export const CATEGORIAS = [
  ['salario', 'Salário'], ['produto', 'Produto'], ['manutencao', 'Manutenção'],
  ['sangria', 'Sangria'], ['outros', 'Outros'],
];
export const nomeCategoria = (c) => CATEGORIAS.find(([k]) => k === c)?.[1] ?? c;
export const REGRAS = { antes_da_divisao: 'Descontar antes da divisão', so_da_empresa: 'Descontar só da parte da empresa' };
