// Relatório da leitura: texto pronto para o WhatsApp e PDF.
// Os dois usam o mesmo "resumo" da leitura (ver lib/leituras.js).
import { moeda, numero, dataHora, percentual, nomeCategoria, REGRAS, situacaoPagamento } from './formato.js';

// O formatador de moeda usa um espaço especial entre "R$" e o valor; troca por espaço comum
const limpo = (t) => String(t).replace(/ /g, ' ');
const rs = (v) => limpo(moeda(v));

export function textoDiferenca(l) {
  if (l.diferenca === null || l.diferenca === undefined) return null;
  if (l.diferenca === 0) return 'Caixa confere';
  return l.diferenca < 0 ? `Faltando ${rs(-l.diferenca)}` : `Sobrando ${rs(l.diferenca)}`;
}

// Texto formatado para o WhatsApp (*negrito*)
export function textoRelatorio(l) {
  const t = [
    '*CONTROLE DE MÁQUINAS*',
    `*Leitura — ${l.pontoNome}*`,
    `Data: ${dataHora(l.dataHora)}`,
  ];
  if (l.operadorNome) t.push(`Leitura feita por: ${l.operadorNome}`);

  t.push('', '*MÁQUINAS*');
  for (const m of l.maquinas) {
    t.push(
      `▪ ${[m.codigo, m.nomeJogo].filter(Boolean).join(' · ')}${m.zerado ? ' (contador zerado)' : ''}`,
      `   Entrada: ${rs(m.entrada)}`,
      `   Saída: ${rs(m.saida)}`,
      `   Resultado: ${rs(m.resultado)}`,
    );
  }

  t.push('', '*TOTAIS*',
    `Entrada: ${rs(l.totalEntrada)}`,
    `Saída: ${rs(l.totalSaida)}`,
    `Resultado bruto: *${rs(l.resultado)}*`);

  t.push('', '*DESPESAS*');
  if (l.despesas.length === 0) t.push('Sem despesas');
  else {
    for (const d of l.despesas) t.push(`▪ ${d.descricao} (${nomeCategoria(d.categoria)}): ${rs(d.valor)}`);
    t.push(`Total de despesas: ${rs(l.totalDespesas)}`, `_${REGRAS[l.regra]}_`);
  }

  t.push('', '*DIVISÃO*',
    `Parte do ponto (${percentual(l.percentual)}): *${rs(l.partePonto)}*`,
    `Parte da empresa: *${rs(l.parteEmpresa)}*`);

  t.push('', '*CAIXA*',
    `Valor que deve estar em caixa: *${rs(l.caixaEsperado)}*`,
    `Após pagar o ponto: ${rs(l.caixaAposPonto)}`,
    `Parte do ponto: ${situacaoPagamento(l).toLowerCase()}`);
  if (l.recolhido !== null && l.recolhido !== undefined) {
    t.push(`Valor recolhido: ${rs(l.recolhido)}`, `Conferência: ${textoDiferenca(l)}`);
  }
  if (l.observacao) t.push('', `Obs.: ${l.observacao}`);
  return t.join('\n');
}

// Link wa.me com o texto pronto. Telefone sem código do país recebe o 55 (Brasil).
// Sem telefone cadastrado, o WhatsApp abre para escolher o contato.
export function linkWhatsApp(telefone, texto) {
  let n = String(telefone ?? '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export function nomeArquivoPdf(l) {
  const ponto = l.pontoNome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(l.dataHora));
  return `leitura-${ponto || 'ponto'}-${dia}.pdf`;
}

// Monta o PDF da leitura (A4). As bibliotecas só são carregadas quando o botão é usado.
export async function gerarPdf(l) {
  const [{ jsPDF }, { default: tabela }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14, largura = 210 - margem * 2;
  const escuro = [15, 23, 42];
  let y = 18;

  doc.setFont('helvetica', 'bold').setFontSize(16).text('Controle de Máquinas', margem, y);
  doc.setFontSize(12).text(`Leitura - ${l.pontoNome}`, margem, (y += 8));
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(`Data: ${dataHora(l.dataHora)}${l.operadorNome ? `     Leitura feita por: ${l.operadorNome}` : ''}`, margem, (y += 6));

  const estilo = { styles: { fontSize: 9, cellPadding: 1.8 }, headStyles: { fillColor: escuro }, margin: { left: margem, right: margem } };
  const direita = (colunas) => Object.fromEntries(colunas.map((c) => [c, { halign: 'right' }]));
  const apos = () => doc.lastAutoTable.finalY + 6;

  tabela(doc, {
    ...estilo, startY: y + 5,
    head: [['Máquina', 'Entrada ant.', 'Entrada atual', 'Saída ant.', 'Saída atual', 'Entrada', 'Saída', 'Resultado']],
    body: l.maquinas.map((m) => [
      `${[m.codigo, m.nomeJogo].filter(Boolean).join(' - ')}${m.zerado ? ' (zerado)' : ''}`,
      numero(m.entradaAnterior), numero(m.entradaAtual), numero(m.saidaAnterior), numero(m.saidaAtual),
      rs(m.entrada), rs(m.saida), rs(m.resultado),
    ]),
    foot: [['Totais', '', '', '', '', rs(l.totalEntrada), rs(l.totalSaida), rs(l.resultado)]],
    footStyles: { fillColor: [226, 232, 240], textColor: escuro, halign: 'right' },
    columnStyles: direita([1, 2, 3, 4, 5, 6, 7]),
    didParseCell: (d) => { if (d.section !== 'body' && d.column.index === 0) d.cell.styles.halign = 'left'; else if (d.section === 'head') d.cell.styles.halign = 'right'; },
  });

  if (l.despesas.length > 0) {
    tabela(doc, {
      ...estilo, startY: apos(),
      head: [['Despesa', 'Categoria', 'Valor']],
      body: l.despesas.map((d) => [d.descricao, nomeCategoria(d.categoria), rs(d.valor)]),
      foot: [[`Total (${REGRAS[l.regra].toLowerCase()})`, '', rs(l.totalDespesas)]],
      footStyles: { fillColor: [226, 232, 240], textColor: escuro },
      columnStyles: direita([2]),
      didParseCell: (d) => { if (d.column.index === 2) d.cell.styles.halign = 'right'; },
    });
  }

  const linhas = [
    [`Parte do ponto (${percentual(l.percentual)})`, rs(l.partePonto)],
    ['Parte da empresa', rs(l.parteEmpresa)],
    ['Caixa após pagar o ponto', rs(l.caixaAposPonto)],
    ['Pagamento ao ponto', situacaoPagamento(l)],
  ];
  if (l.recolhido !== null && l.recolhido !== undefined) {
    linhas.push(['Valor recolhido', rs(l.recolhido)], ['Conferência', textoDiferenca(l)]);
  }
  tabela(doc, {
    ...estilo, startY: apos(), theme: 'plain', tableWidth: largura,
    styles: { fontSize: 10, cellPadding: 1.6 },
    body: linhas, columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
  });

  // Destaque: valor que deve estar em caixa
  y = apos();
  if (y > 262) { doc.addPage(); y = 18; }
  doc.setFillColor(...escuro).roundedRect(margem, y, largura, 20, 2, 2, 'F');
  doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(10)
    .text('VALOR QUE DEVE ESTAR EM CAIXA', 105, y + 7, { align: 'center' });
  doc.setFontSize(18).text(rs(l.caixaEsperado), 105, y + 16, { align: 'center' });
  doc.setTextColor(0).setFont('helvetica', 'normal').setFontSize(10);
  y += 27;

  if (l.observacao) { doc.text(doc.splitTextToSize(`Obs.: ${l.observacao}`, largura), margem, y); y += 10; }
  if (l.conferidoEm) doc.text(`Conferido pelo ponto em ${dataHora(l.conferidoEm)}`, margem, y);
  return doc;
}

// Gera o PDF e entrega: no celular abre o compartilhamento (dá para mandar no WhatsApp);
// no computador, baixa o arquivo.
export async function entregarPdf(l) {
  const doc = await gerarPdf(l);
  const nome = nomeArquivoPdf(l);
  const arquivo = new File([doc.output('blob')], nome, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: `Leitura - ${l.pontoNome}` }); return; }
    catch (e) { if (e.name === 'AbortError') return; } // usuário fechou o compartilhamento
  }
  doc.save(nome);
}
