// Análises (Versão 2): comparativo entre meses, média por máquina e desempenho do operador.
// Só contas, sem banco — dá para testar direto.
import { r2 } from './calculos.js';
import { caixaDevido } from './painel.js';

// "2026-11" -> "2026-10"
export function mesAnterior(mes) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, m - 2, 1)).toISOString().slice(0, 7);
}
// Último dia do mês: "2026-11" -> "2026-11-30"
export const fimDoMes = (mes) => {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
};

// Variação em % do valor atual sobre o anterior (null quando não dá para comparar)
export function variacao(atual, anterior) {
  if (!anterior) return null;
  return r2(((atual - anterior) / Math.abs(anterior)) * 100);
}

const nomeMaquina = (m) => [m.codigo, m.nomeJogo].filter(Boolean).join(' · ');

// Comparativo: resultado do mês escolhido x mês anterior, por ponto e por máquina
export function comparativo(leituras, mes) {
  const antes = mesAnterior(mes);
  const pontos = new Map(), maquinas = new Map();
  const somar = (mapa, id, nome, detalhe, campo, valor) => {
    const x = mapa.get(id) ?? { id, nome, detalhe, atual: 0, anterior: 0 };
    x[campo] = r2(x[campo] + valor);
    mapa.set(id, x);
  };
  for (const l of leituras) {
    const m = l.dataLocal.slice(0, 7);
    const campo = m === mes ? 'atual' : m === antes ? 'anterior' : null;
    if (!campo) continue;
    somar(pontos, l.pontoId, l.pontoNome, '', campo, l.resultado);
    for (const maq of l.maquinas) somar(maquinas, maq.maquinaId, nomeMaquina(maq), l.pontoNome, campo, maq.resultado);
  }
  const fechar = (mapa) => [...mapa.values()]
    .map((x) => ({ ...x, variacao: variacao(x.atual, x.anterior) }))
    .sort((a, b) => b.atual - a.atual);
  const lista = fechar(pontos);
  const total = { atual: r2(lista.reduce((s, p) => s + p.atual, 0)), anterior: r2(lista.reduce((s, p) => s + p.anterior, 0)) };
  return { pontos: lista, maquinas: fechar(maquinas), total: { ...total, variacao: variacao(total.atual, total.anterior) } };
}

// Média por máquina no período: por leitura e por mês. Marca rendimento baixo ou negativo.
// "Baixo" = média por leitura abaixo de metade da média geral das máquinas.
export function mediasPorMaquina(leituras, meses) {
  const mapa = new Map();
  for (const l of leituras) {            // lista vem da leitura mais nova para a mais antiga
    for (const m of l.maquinas) {
      const x = mapa.get(m.maquinaId) ?? { id: m.maquinaId, nome: nomeMaquina(m), ponto: l.pontoNome, total: 0, leituras: 0 };
      x.total = r2(x.total + m.resultado); x.leituras += 1;
      mapa.set(m.maquinaId, x);
    }
  }
  const lista = [...mapa.values()].map((x) => ({
    ...x, mediaLeitura: r2(x.total / x.leituras), mediaMes: r2(x.total / Math.max(meses, 1)),
  }));
  const mediaGeral = lista.length ? r2(lista.reduce((s, x) => s + x.mediaLeitura, 0) / lista.length) : 0;
  for (const x of lista) {
    x.alerta = x.mediaLeitura < 0 ? 'negativo' : (mediaGeral > 0 && x.mediaLeitura < mediaGeral / 2) ? 'baixo' : null;
  }
  return { maquinas: lista.sort((a, b) => a.mediaLeitura - b.mediaLeitura), mediaGeral };
}

// Desempenho por operador: leituras, pontos visitados e diferenças de caixa
export function desempenhoOperadores(leituras) {
  const mapa = new Map();
  for (const l of leituras) {
    const chave = l.operadorNome || '(sem nome)';
    const x = mapa.get(chave) ?? { nome: chave, leituras: 0, pontos: new Set(), comDiferenca: 0, faltando: 0, sobrando: 0, semRecolhido: 0, resultado: 0, esperado: 0, recolhido: 0 };
    x.leituras += 1; x.pontos.add(l.pontoId); x.resultado = r2(x.resultado + l.resultado);
    if (l.recolhido === null) x.semRecolhido += 1;
    else {
      x.esperado = r2(x.esperado + caixaDevido(l)); x.recolhido = r2(x.recolhido + l.recolhido);
      if (l.diferenca < 0) { x.comDiferenca += 1; x.faltando = r2(x.faltando - l.diferenca); }
      if (l.diferenca > 0) { x.comDiferenca += 1; x.sobrando = r2(x.sobrando + l.diferenca); }
    }
    mapa.set(chave, x);
  }
  return [...mapa.values()]
    .map((x) => ({ ...x, pontos: x.pontos.size, saldo: r2(x.sobrando - x.faltando) }))
    .sort((a, b) => b.leituras - a.leituras);
}
