// Quadro com totais, divisão e o destaque "VALOR QUE DEVE ESTAR EM CAIXA".
// Recebe os números já calculados (prévia do celular ou valores do servidor).
import { moeda, numero, REGRAS } from '../lib/formato.js';
import { Cartao, Linha } from './ui.jsx';

export default function Divisao({ c, percentual, regra, pontoPago }) {
  const caixa = pontoPago ? c.caixaAposPonto : c.caixaEsperado;
  return (
    <>
      <Cartao>
        <Linha rotulo="Total entrada" valor={moeda(c.totalEntrada)} />
        <Linha rotulo="Total saída" valor={moeda(c.totalSaida)} />
        <Linha rotulo="Resultado bruto" valor={moeda(c.resultado)} forte />
        <Linha rotulo="Despesas" valor={moeda(c.totalDespesas)} />
        <div className="my-2 border-t border-slate-200" />
        <Linha rotulo={`Parte do ponto (${numero(percentual)}%)`} valor={moeda(c.partePonto)} forte />
        <Linha rotulo="Parte da empresa" valor={moeda(c.parteEmpresa)} forte />
        <div className="pt-1 text-xs text-slate-500">Regra: {REGRAS[regra]}</div>
      </Cartao>

      <div className="rounded-xl bg-slate-900 p-4 text-center text-white shadow">
        <div className="text-sm font-semibold tracking-wide">VALOR QUE DEVE ESTAR EM CAIXA</div>
        <div className="py-1 text-4xl font-bold tabular-nums">{moeda(caixa)}</div>
        <div className="text-sm text-slate-300">
          {pontoPago
            ? `Já descontada a parte do ponto. Antes de pagar: ${moeda(c.caixaEsperado)}`
            : `Antes de pagar o ponto. Depois de pagar: ${moeda(c.caixaAposPonto)}`}
        </div>
      </div>
    </>
  );
}

// Diferença entre o recolhido e o que deveria estar em caixa
export function Diferenca({ valor }) {
  if (valor === null || valor === undefined) return null;
  const cor = valor === 0 ? 'bg-emerald-50 text-emerald-900' : valor < 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  const texto = valor === 0 ? 'Caixa confere' : valor < 0 ? `Faltando ${moeda(-valor)}` : `Sobrando ${moeda(valor)}`;
  return <div className={`rounded-lg px-3 py-3 text-center text-lg font-bold ${cor}`}>{texto}</div>;
}
