// Testes das contas. Rodar: npm run testar:calculos
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularLeitura, calcularDivisao, periodo } from './calculos.js';
import { paraNumero } from './formato.js';

test('exemplo do pedido: entrada 10.000, saída 5.000, 40%, despesa 1.000 só da empresa', () => {
  const c = calcularLeitura({
    maquinas: [{ entradaAnterior: 50000, saidaAnterior: 20000, entradaAtual: 60000, saidaAtual: 25000 }],
    despesas: [{ valor: 1000 }], percentual: 40, regra: 'so_da_empresa', pontoPago: false, recolhido: 4000,
  });
  assert.equal(c.totalEntrada, 10000);
  assert.equal(c.totalSaida, 5000);
  assert.equal(c.partePonto, 2000);
  assert.equal(c.parteEmpresa, 2000);
  assert.equal(c.caixaEsperado, 4000);   // antes de pagar o ponto
  assert.equal(c.caixaAposPonto, 2000);  // depois de pagar o ponto
  assert.equal(c.diferenca, 0);
});

test('regra "antes da divisão"', () => {
  assert.deepEqual(calcularDivisao(5000, 1000, 40, 'antes_da_divisao'),
    { partePonto: 1600, parteEmpresa: 2400, caixaEsperado: 4000, caixaAposPonto: 2400 });
});

test('resultado negativo: ponto fica com zero', () => {
  const d = calcularDivisao(-500, 0, 40, 'so_da_empresa');
  assert.equal(d.partePonto, 0);
  assert.equal(d.parteEmpresa, -500);
});

test('ponto pago na hora: diferença compara com o caixa após o ponto', () => {
  const c = calcularLeitura({
    maquinas: [{ entradaAnterior: 0, saidaAnterior: 0, entradaAtual: 10000, saidaAtual: 5000 }],
    despesas: [], percentual: 40, regra: 'so_da_empresa', pontoPago: true, recolhido: 2900,
  });
  assert.equal(c.caixa, 3000);
  assert.equal(c.diferenca, -100);
});

test('contador zerado usa a leitura atual como movimento', () => {
  assert.equal(periodo(99000, 150), 150);
  assert.equal(periodo(100, 350.5), 250.5);
});

test('digitação de valores no formato brasileiro', () => {
  assert.equal(paraNumero('1.234,56'), 1234.56);
  assert.equal(paraNumero('10.000'), 10000);
  assert.equal(paraNumero('1234.5'), 1234.5);
  assert.equal(paraNumero('R$ 50'), 50);
  assert.equal(paraNumero(''), null);
  assert.equal(paraNumero('abc'), null);
});
