// Testes do relatório (texto do WhatsApp e PDF). Rodar: npm run testar:calculos
import test from 'node:test';
import assert from 'node:assert/strict';
import { resumoLocal } from './leituras.js';
import { textoRelatorio, linkWhatsApp, gerarPdf, nomeArquivoPdf } from './relatorio.js';

// O exemplo do pedido: entrada 10.000, saída 5.000, ponto 40%, despesa 1.000 "só da empresa"
const leitura = resumoLocal({
  id: 'x', operadorNome: 'João', dataHora: '2026-11-17T17:30:00Z', pontoPago: false, recolhido: 4000, observacao: 'Tudo certo',
  ponto: { id: 'p', nome: 'Bar do Zé', telefone: '11999998888', percentual_ponto: 40, regra_despesa: 'so_da_empresa' },
  maquinas: [{ maquinaId: 'm', codigo: '001', nomeJogo: 'Jogo A', zerado: false,
    entradaAnterior: 50000, saidaAnterior: 20000, entradaAtual: 60000, saidaAtual: 25000 }],
  despesas: [{ descricao: 'Conserto', valor: 1000, categoria: 'manutencao' }],
});

test('texto do WhatsApp traz todos os valores do exemplo', () => {
  const t = textoRelatorio(leitura);
  for (const trecho of [
    'Leitura — Bar do Zé', 'Data: 17/11/2026 14:30', 'Leitura feita por: João', '001 · Jogo A',
    'Entrada: R$ 10.000,00', 'Saída: R$ 5.000,00', 'Resultado bruto: *R$ 5.000,00*',
    'Conserto (Manutenção): R$ 1.000,00', 'Parte do ponto (40%): *R$ 2.000,00*', 'Parte da empresa: *R$ 2.000,00*',
    'Valor que deve estar em caixa: *R$ 4.000,00*', 'Após pagar o ponto: R$ 2.000,00', 'Conferência: Caixa confere', 'Obs.: Tudo certo',
  ]) assert.ok(t.includes(trecho), `faltou: ${trecho}`);
});

test('link do WhatsApp usa o número do ponto com 55', () => {
  const link = linkWhatsApp('(11) 99999-8888', 'Olá, tudo bem?');
  assert.equal(link, 'https://wa.me/5511999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F');
  assert.ok(linkWhatsApp('', 'a').startsWith('https://wa.me/?text='));
  assert.ok(linkWhatsApp('5511999998888', 'a').startsWith('https://wa.me/5511999998888?'));
});

test('PDF é gerado', async () => {
  const doc = await gerarPdf(leitura);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 3000);
  assert.equal(nomeArquivoPdf(leitura), 'leitura-bar-do-ze-2026-11-17.pdf');
  (await import('node:fs')).writeFileSync(process.env.PDF_SAIDA || '/dev/null', bytes);
});
