// Lista editável de despesas da leitura (descrição, valor e categoria)
import { CATEGORIAS, paraNumero } from '../lib/formato.js';
import { Cartao, Campo, CampoValor, Selecao } from './ui.jsx';

export const despesaVazia = () => ({ descricao: '', valor: '', categoria: 'outros' });

// Converte as linhas digitadas em despesas válidas; devolve erro se alguma estiver incompleta
export function lerDespesas(linhas) {
  const despesas = [];
  for (const l of linhas) {
    const valor = paraNumero(l.valor);
    if (!l.descricao.trim() && l.valor === '') continue; // linha em branco é ignorada
    if (!l.descricao.trim() || !valor) return { erro: 'Despesa incompleta: informe descrição e valor maior que zero.' };
    despesas.push({ descricao: l.descricao.trim(), valor, categoria: l.categoria });
  }
  return { despesas };
}

export default function Despesas({ linhas, onChange }) {
  const mudar = (i, campo, valor) => onChange(linhas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  return (
    <Cartao className="space-y-3">
      <h2 className="font-semibold">Despesas</h2>
      {linhas.map((l, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <Campo rotulo="Descrição" value={l.descricao} onChange={(e) => mudar(i, 'descricao', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <CampoValor rotulo="Valor (R$)" value={l.valor} onChange={(v) => mudar(i, 'valor', v)} />
            <Selecao rotulo="Categoria" value={l.categoria} onChange={(e) => mudar(i, 'categoria', e.target.value)}>
              {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selecao>
          </div>
          <button type="button" onClick={() => onChange(linhas.filter((_, j) => j !== i))}
            className="py-1 text-sm text-red-700 underline">Remover despesa</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...linhas, despesaVazia()])}
        className="min-h-12 w-full rounded-lg border-2 border-dashed border-slate-300 font-semibold text-slate-700">
        + Adicionar despesa
      </button>
    </Cartao>
  );
}
