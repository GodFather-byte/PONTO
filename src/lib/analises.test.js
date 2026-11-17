// Testes das análises da Versão 2. Rodar: npm run testar:calculos
import test from 'node:test';
import assert from 'node:assert/strict';
import { comparativo, mediasPorMaquina, desempenhoOperadores, variacao, mesAnterior, fimDoMes } from './analises.js';

const L = (dataLocal, pontoId, operador, maquinas, extra = {}) => ({
  dataLocal, pontoId, pontoNome: pontoId === 'p1' ? 'Bar do Zé' : 'Lanchonete', operadorNome: operador,
  resultado: maquinas.reduce((s, m) => s + m[1], 0),
  maquinas: maquinas.map(([id, resultado]) => ({ maquinaId: id, codigo: id, nomeJogo: '', resultado })),
  recolhido: null, diferenca: null, pontoPago: false, caixaEsperado: 0, caixaAposPonto: 0, ...extra,
});
const lista = [
  L('2026-11-10', 'p1', 'João', [['m1', 3000], ['m2', -200]], { recolhido: 2700, diferenca: -100, caixaEsperado: 2800 }),
  L('2026-11-03', 'p2', 'João', [['m3', 500]], { recolhido: 520, diferenca: 20, caixaEsperado: 500 }),
  L('2026-10-20', 'p1', 'Maria', [['m1', 2000], ['m2', 100]], { recolhido: 2100, diferenca: 0, caixaEsperado: 2100 }),
  L('2026-10-05', 'p2', 'Maria', [['m3', 1000]]),
  L('2026-09-01', 'p1', 'Maria', [['m1', 9999]]), // fora dos dois meses: não entra no comparativo
];

test('datas dos meses', () => {
  assert.equal(mesAnterior('2026-11'), '2026-10');
  assert.equal(mesAnterior('2026-01'), '2025-12');
  assert.equal(fimDoMes('2026-02'), '2026-02-28');
});

test('variação em %', () => {
  assert.equal(variacao(150, 100), 50);
  assert.equal(variacao(50, 100), -50);
  assert.equal(variacao(100, -100), 200);  // saiu do prejuízo
  assert.equal(variacao(100, 0), null);    // sem base de comparação
});

test('comparativo do mês contra o anterior, por ponto e por máquina', () => {
  const c = comparativo(lista, '2026-11');
  assert.deepEqual(c.pontos.map((p) => [p.nome, p.atual, p.anterior, p.variacao]),
    [['Bar do Zé', 2800, 2100, 33.33], ['Lanchonete', 500, 1000, -50]]);
  assert.deepEqual(c.maquinas.map((m) => [m.id, m.atual, m.anterior, m.variacao]),
    [['m1', 3000, 2000, 50], ['m3', 500, 1000, -50], ['m2', -200, 100, -300]]);
  assert.deepEqual(c.total, { atual: 3300, anterior: 3100, variacao: 6.45 });
});

test('média por máquina e alerta de rendimento baixo ou negativo', () => {
  const { maquinas, mediaGeral } = mediasPorMaquina(lista.slice(0, 4), 2);
  const m = Object.fromEntries(maquinas.map((x) => [x.id, x]));
  assert.deepEqual([m.m1.mediaLeitura, m.m1.mediaMes, m.m1.alerta], [2500, 2500, null]);
  assert.deepEqual([m.m2.mediaLeitura, m.m2.alerta], [-50, 'negativo']);
  assert.deepEqual([m.m3.mediaLeitura, m.m3.mediaMes], [750, 750]);
  assert.equal(mediaGeral, 1066.67);
  assert.equal(m.m3.alerta, null);          // 750 está acima de metade da média geral (533)
  assert.equal(maquinas[0].id, 'm2');       // pior primeiro
});

test('desempenho por operador', () => {
  const d = Object.fromEntries(desempenhoOperadores(lista.slice(0, 4)).map((x) => [x.nome, x]));
  assert.deepEqual([d['João'].leituras, d['João'].pontos, d['João'].comDiferenca, d['João'].faltando, d['João'].sobrando, d['João'].saldo],
    [2, 2, 2, 100, 20, -80]);
  assert.deepEqual([d.Maria.leituras, d.Maria.pontos, d.Maria.comDiferenca, d.Maria.semRecolhido], [2, 2, 0, 1]);
});
