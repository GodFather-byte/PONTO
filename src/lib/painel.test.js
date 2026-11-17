// Testes das somas do painel e da exportação. Rodar: npm run testar:calculos
import test from 'node:test';
import assert from 'node:assert/strict';
import { totalizar, ranking, controleCaixa, inicioSemana, inicioMes, somaDias, diasEntre } from './painel.js';
import { csvLeituras, gerarCsv, gerarPdfPeriodo } from './exportar.js';

const leitura = (extra) => ({
  id: 'x', pontoId: 'p1', pontoNome: 'Bar do Zé', dataHora: '2026-11-17T17:30:00Z', operadorNome: 'João', percentual: 40,
  totalEntrada: 10000, totalSaida: 5000, resultado: 5000, totalDespesas: 1000, partePonto: 2000, parteEmpresa: 2000,
  caixaEsperado: 4000, caixaAposPonto: 2000, pontoPago: false, recolhido: 4000, diferenca: 0, conferidoEm: null, observacao: '',
  maquinas: [{ maquinaId: 'm1', codigo: '001', nomeJogo: 'Jogo A', entrada: 10000, saida: 5000, resultado: 5000 }],
  despesas: [{ descricao: 'Retirada', valor: 600, categoria: 'sangria' }, { descricao: 'Conserto', valor: 400, categoria: 'manutencao' }],
  ...extra,
});
const lista = [
  leitura(),
  leitura({ pontoId: 'p2', pontoNome: 'Lanchonete', resultado: 800, totalEntrada: 1000, totalSaida: 200, totalDespesas: 0, partePonto: 400, parteEmpresa: 400,
    caixaEsperado: 800, caixaAposPonto: 400, pontoPago: true, recolhido: 350, diferenca: -50, despesas: [],
    maquinas: [{ maquinaId: 'm2', codigo: '002', nomeJogo: 'Jogo B', entrada: 1000, saida: 200, resultado: 800 }] }),
  leitura({ recolhido: null, diferenca: null, despesas: [] }),
];

test('totais do período', () => {
  const t = totalizar(lista);
  assert.deepEqual([t.qtd, t.entrada, t.saida, t.resultado, t.partePonto, t.parteEmpresa], [3, 21000, 10200, 10800, 4400, 4400]);
});

test('ranking de pontos e máquinas pelo resultado', () => {
  const r = ranking(lista);
  assert.deepEqual(r.pontos.map((p) => [p.nome, p.resultado, p.qtd]), [['Bar do Zé', 10000, 2], ['Lanchonete', 800, 1]]);
  assert.deepEqual(r.maquinas.map((m) => [m.nome, m.resultado]), [['001 · Jogo A', 10000], ['002 · Jogo B', 800]]);
});

test('controle de caixa: esperado x recolhido e sangrias', () => {
  const c = controleCaixa(lista);
  assert.equal(c.esperado, 4400);   // 4.000 (ponto a pagar) + 400 (ponto já pago)
  assert.equal(c.recolhido, 4350);
  assert.equal(c.diferenca, -50);
  assert.equal(c.comDiferenca, 1);
  assert.equal(c.semRecolhido, 1);
  assert.equal(c.valorSemRecolhido, 4000);
  assert.equal(c.sangrias, 600);
  assert.equal(c.porCategoria.manutencao, 400);
});

test('datas: semana começa na segunda, mês no dia 1', () => {
  assert.equal(inicioSemana('2026-11-17'), '2026-11-16'); // terça -> segunda
  assert.equal(inicioSemana('2026-11-22'), '2026-11-16'); // domingo -> segunda anterior
  assert.equal(inicioMes('2026-11-17'), '2026-11-01');
  assert.equal(somaDias('2026-11-01', -1), '2026-10-31');
  assert.equal(diasEntre('2026-11-07', '2026-11-17'), 10);
});

test('CSV no padrão brasileiro', () => {
  assert.equal(gerarCsv([['a;b', 1234.5, null, 'diz "oi"']]), '﻿"a;b";1234,5;;"diz ""oi"""');
  const linhas = csvLeituras(lista).split('\r\n');
  assert.equal(linhas.length, 4);
  assert.ok(linhas[1].startsWith('17/11/2026 14:30;Bar do Zé;João;10000;5000;5000;1000;40;2000;2000;4000;Não;4000;0;'));
});

test('PDF do período é gerado', async () => {
  const doc = await gerarPdfPeriodo({ inicio: '2026-11-01', fim: '2026-11-17', leituras: lista });
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  (await import('node:fs')).writeFileSync(process.env.PDF_PERIODO || '/dev/null', bytes);
});
