// Contas da leitura. É a mesma regra da função calcular_divisao() do banco:
// o celular usa para mostrar a prévia; o valor oficial é o que o servidor grava.

// Arredonda para centavos sem erro de ponto flutuante
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Movimento de um contador no período. Se a leitura atual é menor que a anterior
// (contador zerado), a própria leitura atual é o movimento.
export function periodo(anterior, atual) {
  return r2(atual < anterior ? atual : atual - anterior);
}

// Uma máquina: { entradaAnterior, saidaAnterior, entradaAtual, saidaAtual }
export function calcularMaquina(m) {
  const entrada = periodo(m.entradaAnterior, m.entradaAtual);
  const saida = periodo(m.saidaAnterior, m.saidaAtual);
  return {
    entrada, saida, resultado: r2(entrada - saida),
    // true = alguma leitura atual menor que a anterior (precisa confirmar "contador zerado")
    menor: m.entradaAtual < m.entradaAnterior || m.saidaAtual < m.saidaAnterior,
  };
}

// Divisão entre ponto e empresa
export function calcularDivisao(resultado, despesas, percentual, regra) {
  let partePonto, parteEmpresa;
  if (regra === 'antes_da_divisao') {
    const base = resultado - despesas;
    partePonto = Math.max(0, r2(base * percentual / 100)); // prejuízo não é dividido com o ponto
    parteEmpresa = r2(base - partePonto);
  } else {
    partePonto = Math.max(0, r2(resultado * percentual / 100));
    parteEmpresa = r2(resultado - partePonto - despesas);
  }
  const caixaEsperado = r2(resultado - despesas);          // antes de pagar o ponto
  const caixaAposPonto = r2(caixaEsperado - partePonto);   // depois de pagar o ponto
  return { partePonto, parteEmpresa, caixaEsperado, caixaAposPonto };
}

// Leitura inteira: soma as máquinas e despesas e aplica a divisão
export function calcularLeitura({ maquinas, despesas, percentual, regra, pontoPago, recolhido }) {
  const itens = maquinas.map(calcularMaquina);
  const totalEntrada = r2(itens.reduce((s, i) => s + i.entrada, 0));
  const totalSaida = r2(itens.reduce((s, i) => s + i.saida, 0));
  const resultado = r2(totalEntrada - totalSaida);
  const totalDespesas = r2(despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0));
  const div = calcularDivisao(resultado, totalDespesas, percentual, regra);
  const caixa = pontoPago ? div.caixaAposPonto : div.caixaEsperado; // quanto deve estar em caixa agora
  return {
    itens, totalEntrada, totalSaida, resultado, totalDespesas, ...div, caixa,
    diferenca: recolhido === null || recolhido === undefined ? null : r2(recolhido - caixa),
  };
}
