// Gráfico de barras em pares: mês atual x mês anterior, uma linha por item.
// Uma cor só em dois tons (escuro = atual, claro = anterior); valores e nomes ficam em texto normal.
import { moeda } from '../lib/formato.js';

export const COR_ATUAL = '#2a78d6';
export const COR_ANTERIOR = '#86b6ef';

// Texto da variação: sempre com seta e sinal, nunca só cor
export function TextoVariacao({ v, temAnterior }) {
  if (v === null) return <span className="text-slate-500">{temAnterior ? '—' : 'sem mês anterior'}</span>;
  const n = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.abs(v));
  if (v === 0) return <span className="text-slate-600">= igual</span>;
  return <span className="font-semibold text-slate-800">{v > 0 ? '▲ +' : '▼ −'}{n}%</span>;
}

export function Legenda({ atual, anterior }) {
  const Item = ({ cor, texto }) => (
    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: cor }} />{texto}</span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      <Item cor={COR_ATUAL} texto={atual} /><Item cor={COR_ANTERIOR} texto={anterior} />
    </div>
  );
}

export default function BarrasComparativas({ itens, rotuloAtual, rotuloAnterior }) {
  // Escala comum a todas as linhas; o zero só sai da borda esquerda se houver valor negativo
  const valores = itens.flatMap((i) => [i.atual, i.anterior]);
  const min = Math.min(0, ...valores), max = Math.max(0, ...valores);
  const faixa = max - min || 1;
  const zero = (-min / faixa) * 100;

  const Barra = ({ valor, cor, titulo }) => {
    const largura = (Math.abs(valor) / faixa) * 100;
    const positivo = valor >= 0;
    return (
      <div className="relative h-2.5" title={`${titulo}: ${moeda(valor)}`}>
        <div className="absolute inset-y-0" style={{
          left: `${positivo ? zero : zero - largura}%`, width: `${Math.max(largura, valor ? 0.8 : 0)}%`, background: cor,
          borderRadius: positivo ? '0 4px 4px 0' : '4px 0 0 4px', // ponta arredondada só do lado do dado
        }} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {itens.map((i) => (
        <div key={i.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{i.nome}</span>
            <span className="shrink-0 text-sm"><TextoVariacao v={i.variacao} temAnterior={i.anterior !== 0} /></span>
          </div>
          {i.detalhe && <div className="text-xs text-slate-500">{i.detalhe}</div>}
          <div className="relative mt-1.5 space-y-0.5">
            {min < 0 && <div className="absolute inset-y-0 w-px bg-slate-300" style={{ left: `${zero}%` }} />}
            <Barra valor={i.atual} cor={COR_ATUAL} titulo={rotuloAtual} />
            <Barra valor={i.anterior} cor={COR_ANTERIOR} titulo={rotuloAnterior} />
          </div>
          <div className="mt-1 flex justify-between text-sm tabular-nums">
            <span className="font-semibold">{moeda(i.atual)}</span>
            <span className="text-slate-500">antes {moeda(i.anterior)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
