// Busca leituras e monta um "resumo" único, usado na tela de detalhe e nos relatórios.
// O mesmo formato serve para leitura já salva no servidor e para leitura ainda na fila.
import { supabase } from './supabase.js';
import { listarFila, comLimite } from './fila.js';
import { calcularLeitura } from './calculos.js';

// Resumo a partir do que o operador acabou de digitar (antes de chegar ao servidor)
export function resumoLocal({ id, ponto, operadorNome, dataHora, maquinas, despesas, pontoPago, recolhido, observacao }) {
  const c = calcularLeitura({
    maquinas, despesas, percentual: Number(ponto.percentual_ponto), regra: ponto.regra_despesa, pontoPago, recolhido,
  });
  return {
    id, pontoId: ponto.id, pontoNome: ponto.nome, pontoTelefone: ponto.telefone, dataHora, operadorNome,
    percentual: Number(ponto.percentual_ponto), regra: ponto.regra_despesa,
    maquinas: maquinas.map((m, i) => ({ ...m, ...c.itens[i] })),
    despesas, totalEntrada: c.totalEntrada, totalSaida: c.totalSaida, resultado: c.resultado,
    totalDespesas: c.totalDespesas, partePonto: c.partePonto, parteEmpresa: c.parteEmpresa,
    caixaEsperado: c.caixaEsperado, caixaAposPonto: c.caixaAposPonto,
    pontoPago, recolhido, diferenca: c.diferenca, observacao, conferidoEm: null, pendente: true,
  };
}

const n = (v) => (v === null || v === undefined ? null : Number(v));

// Resumo a partir das linhas do banco
function resumoServidor(l) {
  return {
    id: l.id, pontoId: l.ponto_id, pontoNome: l.pontos?.nome ?? '', pontoTelefone: l.pontos?.telefone ?? '',
    dataHora: l.data_hora, operadorNome: l.operador_nome, percentual: n(l.percentual_ponto), regra: l.regra_despesa,
    maquinas: (l.leitura_maquinas ?? []).sort((a, b) => a.id - b.id).map((m) => ({
      maquinaId: m.maquina_id, codigo: m.maquinas?.codigo ?? '', nomeJogo: m.maquinas?.nome_jogo ?? '',
      entradaAnterior: n(m.entrada_anterior), saidaAnterior: n(m.saida_anterior),
      entradaAtual: n(m.entrada_atual), saidaAtual: n(m.saida_atual),
      entrada: n(m.entrada_periodo), saida: n(m.saida_periodo), resultado: n(m.resultado),
      zerado: m.contador_zerado, fotoCaminho: m.foto_caminho,
    })),
    despesas: (l.despesas ?? []).sort((a, b) => a.id - b.id)
      .map((d) => ({ descricao: d.descricao, valor: n(d.valor), categoria: d.categoria })),
    totalEntrada: n(l.total_entrada), totalSaida: n(l.total_saida), resultado: n(l.resultado),
    totalDespesas: n(l.total_despesas), partePonto: n(l.parte_ponto), parteEmpresa: n(l.parte_empresa),
    caixaEsperado: n(l.caixa_esperado), caixaAposPonto: n(l.caixa_apos_ponto),
    pontoPago: l.ponto_pago_na_hora, recolhido: n(l.valor_recolhido), diferenca: n(l.diferenca),
    observacao: l.observacao, conferidoEm: l.conferido_em, pendente: false,
  };
}

const CAMPOS = '*, pontos(nome, telefone), leitura_maquinas(*, maquinas(codigo, nome_jogo)), despesas(*)';

// Uma leitura: primeiro na fila do aparelho (rápido, funciona sem sinal), depois no servidor
export async function buscarLeitura(id) {
  const item = (await listarFila()).find((i) => i.id === id);
  if (item) return { ...item.resumo, erro: item.erro };
  try {
    const { data } = await comLimite(supabase.from('leituras').select(CAMPOS).eq('id', id).maybeSingle(), 10000);
    return data ? resumoServidor(data) : null;
  } catch { return null; }
}

// Lista das últimas leituras (pendentes do aparelho primeiro)
export async function listarLeituras(pontoId) {
  const pendentes = (await listarFila())
    .filter((i) => !pontoId || i.payload.ponto_id === pontoId)
    .map((i) => ({ ...i.resumo, erro: i.erro })).reverse();
  let salvas = [], offline = false;
  try {
    let q = supabase.from('leituras').select('*, pontos(nome, telefone)').order('data_hora', { ascending: false }).limit(100);
    if (pontoId) q = q.eq('ponto_id', pontoId);
    if (!navigator.onLine) throw new Error('offline');
    const { data, error } = await comLimite(q);
    if (error) throw error;
    const idsPendentes = new Set(pendentes.map((p) => p.id));
    salvas = data.filter((l) => !idsPendentes.has(l.id)).map(resumoServidor);
  } catch { offline = true; }
  return { leituras: [...pendentes, ...salvas], offline };
}
