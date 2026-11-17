// Exportação do período: CSV (abre no Excel / Google Planilhas) e PDF.
import { dataHora, nomeCategoria, dataSimples, FORMAS } from './formato.js';
import { totalizar, ranking, controleCaixa, caixaDevido, dataBR } from './painel.js';

const limpo = (t) => String(t).replace(/ /g, ' ');
const rs = (v) => limpo(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0));

// Monta o CSV no padrão brasileiro: separador ";" e vírgula decimal (o Excel abre direto)
export function gerarCsv(linhas) {
  const celula = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const t = String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n'); // ﻿ = acentos certos no Excel
}

// Uma linha por leitura
export function csvLeituras(leituras) {
  return gerarCsv([
    ['Data', 'Ponto', 'Operador', 'Entrada', 'Saída', 'Resultado', 'Despesas', '% do ponto', 'Parte do ponto', 'Parte da empresa',
      'Caixa esperado', 'Ponto pago na hora', 'Valor recolhido', 'Diferença', 'Conferido em', 'Ponto pago em', 'Forma de pagamento', 'Observação'],
    ...leituras.map((l) => [
      dataHora(l.dataHora), l.pontoNome, l.operadorNome, l.totalEntrada, l.totalSaida, l.resultado, l.totalDespesas, l.percentual,
      l.partePonto, l.parteEmpresa, caixaDevido(l), l.pontoPago ? 'Sim' : 'Não', l.recolhido, l.diferenca,
      l.conferidoEm ? dataHora(l.conferidoEm) : '', dataSimples(l.pagoEm), FORMAS[l.pagoForma] ?? '', l.observacao,
    ]),
  ]);
}

// Uma linha por máquina de cada leitura
export function csvMaquinas(leituras) {
  return gerarCsv([
    ['Data', 'Ponto', 'Máquina', 'Jogo', 'Entrada anterior', 'Entrada atual', 'Saída anterior', 'Saída atual', 'Entrada', 'Saída', 'Resultado', 'Contador zerado'],
    ...leituras.flatMap((l) => l.maquinas.map((m) => [
      dataHora(l.dataHora), l.pontoNome, m.codigo, m.nomeJogo, m.entradaAnterior, m.entradaAtual, m.saidaAnterior, m.saidaAtual,
      m.entrada, m.saida, m.resultado, m.zerado ? 'Sim' : 'Não',
    ])),
  ]);
}

// Uma linha por despesa
export function csvDespesas(leituras) {
  return gerarCsv([
    ['Data', 'Ponto', 'Descrição', 'Categoria', 'Valor'],
    ...leituras.flatMap((l) => l.despesas.map((d) => [dataHora(l.dataHora), l.pontoNome, d.descricao, nomeCategoria(d.categoria), d.valor])),
  ]);
}

// Entrega um arquivo ao usuário (download)
export function baixar(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// PDF do período: totais, caixa, rankings e a lista de leituras
export async function gerarPdfPeriodo({ inicio, fim, leituras }) {
  const [{ jsPDF }, { default: tabela }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14, escuro = [15, 23, 42];
  const t = totalizar(leituras), c = controleCaixa(leituras), rk = ranking(leituras);

  doc.setFont('helvetica', 'bold').setFontSize(16).text('Controle de Máquinas', margem, 18);
  doc.setFontSize(12).text(`Relatório do período: ${dataBR(inicio)} a ${dataBR(fim)}`, margem, 26);
  doc.setFont('helvetica', 'normal').setFontSize(10).text(`${t.qtd} leitura(s)`, margem, 32);

  const base = { styles: { fontSize: 9, cellPadding: 1.8 }, headStyles: { fillColor: escuro }, margin: { left: margem, right: margem } };
  const direita = (inicioCol) => (d) => { if (d.column.index >= inicioCol) d.cell.styles.halign = 'right'; };
  const apos = () => doc.lastAutoTable.finalY + 7;

  tabela(doc, {
    ...base, startY: 37, head: [['Totais', 'Valor', 'Controle de caixa', 'Valor']],
    body: [
      ['Entrada', rs(t.entrada), 'Esperado em caixa', rs(c.esperado)],
      ['Saída', rs(t.saida), 'Recolhido', rs(c.recolhido)],
      ['Resultado bruto', rs(t.resultado), 'Diferença', rs(c.diferenca)],
      ['Despesas', rs(t.despesas), 'Leituras com diferença', String(c.comDiferenca)],
      ['Parte dos pontos', rs(t.partePonto), 'Sangrias', rs(c.sangrias)],
      ['Parte da empresa', rs(t.parteEmpresa), 'Leituras sem recolhido', `${c.semRecolhido} (${rs(c.valorSemRecolhido)})`],
    ],
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' }, 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
  });

  tabela(doc, {
    ...base, startY: apos(), head: [['#', 'Ponto', 'Leituras', 'Resultado']],
    body: rk.pontos.map((p, i) => [i + 1, p.nome, p.qtd, rs(p.resultado)]), didParseCell: direita(2),
  });
  tabela(doc, {
    ...base, startY: apos(), head: [['#', 'Máquina', 'Ponto', 'Entrada', 'Saída', 'Resultado']],
    body: rk.maquinas.map((m, i) => [i + 1, m.nome.replace(' · ', ' - '), m.ponto, rs(m.entrada), rs(m.saida), rs(m.resultado)]),
    didParseCell: direita(3),
  });
  tabela(doc, {
    ...base, startY: apos(), styles: { fontSize: 8, cellPadding: 1.5 },
    head: [['Data', 'Ponto', 'Resultado', 'Despesas', 'Ponto', 'Empresa', 'Recolhido', 'Diferença', 'Conf.']],
    body: leituras.map((l) => [dataHora(l.dataHora), l.pontoNome, rs(l.resultado), rs(l.totalDespesas), rs(l.partePonto), rs(l.parteEmpresa),
      l.recolhido === null ? '-' : rs(l.recolhido), l.diferenca === null ? '-' : rs(l.diferenca), l.conferidoEm ? 'Sim' : 'Não']),
    didParseCell: direita(2),
  });
  return doc;
}
