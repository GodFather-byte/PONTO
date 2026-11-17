// Painel do Admin: datas (fuso de São Paulo), busca do período e somas.
// As funções de soma são puras (só fazem conta), por isso dá para testar sem banco.
import { supabase } from './supabase.js';
import { resumoServidor } from './leituras.js';
import { r2 } from './calculos.js';

// ---------- Datas no formato "aaaa-mm-dd" ----------
export const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export function somaDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Semana começa na segunda-feira
export const inicioSemana = (dia) => somaDias(dia, -((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7));
export const inicioMes = (dia) => `${dia.slice(0, 7)}-01`;
export const diasEntre = (de, ate) => Math.round((new Date(`${ate}T12:00:00Z`) - new Date(`${de}T12:00:00Z`)) / 86400000);
export const dataBR = (dia) => (dia ? dia.split('-').reverse().join('/') : '');

// ---------- Somas ----------
const soma = (lista, fn) => r2(lista.reduce((s, x) => s + (fn(x) || 0), 0));

export function totalizar(leituras) {
  return {
    qtd: leituras.length,
    entrada: soma(leituras, (l) => l.totalEntrada), saida: soma(leituras, (l) => l.totalSaida),
    resultado: soma(leituras, (l) => l.resultado), despesas: soma(leituras, (l) => l.totalDespesas),
    partePonto: soma(leituras, (l) => l.partePonto), parteEmpresa: soma(leituras, (l) => l.parteEmpresa),
  };
}

// Ranking de pontos e de máquinas pelo resultado (maior primeiro)
export function ranking(leituras) {
  const pontos = new Map(), maquinas = new Map();
  for (const l of leituras) {
    const p = pontos.get(l.pontoId) ?? { nome: l.pontoNome, resultado: 0, qtd: 0 };
    p.resultado = r2(p.resultado + l.resultado); p.qtd += 1;
    pontos.set(l.pontoId, p);
    for (const m of l.maquinas) {
      const q = maquinas.get(m.maquinaId) ?? { nome: [m.codigo, m.nomeJogo].filter(Boolean).join(' · '), ponto: l.pontoNome, resultado: 0, entrada: 0, saida: 0 };
      q.resultado = r2(q.resultado + m.resultado); q.entrada = r2(q.entrada + m.entrada); q.saida = r2(q.saida + m.saida);
      // o ponto mostrado é o da leitura mais recente (a lista vem da mais nova para a mais antiga)
      maquinas.set(m.maquinaId, q);
    }
  }
  const ordenar = (mapa) => [...mapa.values()].sort((a, b) => b.resultado - a.resultado);
  return { pontos: ordenar(pontos), maquinas: ordenar(maquinas) };
}

// Quanto devia estar em caixa em cada leitura (depende de o ponto ter sido pago na hora)
export const caixaDevido = (l) => (l.pontoPago ? l.caixaAposPonto : l.caixaEsperado);

// Controle de caixa: esperado x recolhido (só leituras com recolhido informado), sangrias e despesas por categoria
export function controleCaixa(leituras) {
  const informadas = leituras.filter((l) => l.recolhido !== null);
  const sem = leituras.filter((l) => l.recolhido === null);
  const porCategoria = {};
  for (const l of leituras) for (const d of l.despesas) porCategoria[d.categoria] = r2((porCategoria[d.categoria] ?? 0) + d.valor);
  const esperado = soma(informadas, caixaDevido), recolhido = soma(informadas, (l) => l.recolhido);
  return {
    esperado, recolhido, diferenca: r2(recolhido - esperado),
    comDiferenca: informadas.filter((l) => l.diferenca !== 0).length,
    semRecolhido: sem.length, valorSemRecolhido: soma(sem, caixaDevido),
    sangrias: porCategoria.sangria ?? 0, porCategoria,
  };
}

// ---------- Busca ----------
const CAMPOS = '*, pontos(nome, telefone), leitura_maquinas(*, maquinas(codigo, nome_jogo)), despesas(*)';

// Todas as leituras entre duas datas (busca em blocos, porque o Supabase limita a 1000 linhas por vez)
export async function buscarPeriodo(inicio, fim) {
  const tudo = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await supabase.from('leituras').select(CAMPOS)
      .gte('data_local', inicio).lte('data_local', fim)
      .order('data_hora', { ascending: false }).range(de, de + 499);
    if (error) throw error;
    tudo.push(...data.map(resumoServidor));
    if (data.length < 500) return tudo;
  }
}

// Manutenções do período (para somar o custo que ficou só com a empresa)
export async function buscarManutencoes(inicio, fim) {
  const { data, error } = await supabase.from('manutencoes').select('custo, destino, leitura_id').gte('data', inicio).lte('data', fim);
  if (error) throw error;
  return {
    soEmpresa: r2(data.filter((m) => m.destino === 'so_da_empresa').reduce((s, m) => s + Number(m.custo), 0)),
    aLancar: r2(data.filter((m) => m.destino === 'despesa_do_ponto' && !m.leitura_id).reduce((s, m) => s + Number(m.custo), 0)),
    qtd: data.length,
  };
}

// Pontos ativos e há quantos dias estão sem leitura (null = nunca teve leitura)
export async function pontosSemLeitura(limiteDias) {
  const { data, error } = await supabase.from('pontos').select('id, nome, leituras(data_local)')
    .eq('ativo', true).order('nome')
    .order('data_hora', { referencedTable: 'leituras', ascending: false }).limit(1, { referencedTable: 'leituras' });
  if (error) throw error;
  const hoje = hojeSP();
  return data
    .map((p) => ({ id: p.id, nome: p.nome, ultima: p.leituras[0]?.data_local ?? null,
      dias: p.leituras[0] ? diasEntre(p.leituras[0].data_local, hoje) : null }))
    .filter((p) => p.dias === null || p.dias > limiteDias)
    .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity));
}
