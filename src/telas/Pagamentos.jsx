// Pagamentos aos pontos: o que ainda está pendente, somado por ponto.
// Tocar em uma leitura abre o detalhe, onde o pagamento é registrado.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarPendentesDePagamento } from '../lib/leituras.js';
import { moeda, dataHora } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Pagamentos() {
  const [pendentes, setPendentes] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { listarPendentesDePagamento().then(setPendentes).catch((e) => setErro(e.message)); }, []);

  // Agrupa por ponto, maior valor pendente primeiro
  const grupos = new Map();
  for (const l of pendentes ?? []) {
    const g = grupos.get(l.pontoId) ?? { nome: l.pontoNome, total: 0, leituras: [] };
    g.total += l.partePonto; g.leituras.push(l);
    grupos.set(l.pontoId, g);
  }
  const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
  const total = lista.reduce((s, g) => s + g.total, 0);

  return (
    <Tela titulo="Pagamentos aos pontos" voltar="/">
      <Aviso tom="erro">{erro}</Aviso>
      {!pendentes && !erro && <Cartao>Carregando…</Cartao>}
      {pendentes && (
        <div className="rounded-xl bg-slate-900 p-4 text-center text-white shadow">
          <div className="text-sm font-semibold tracking-wide">TOTAL PENDENTE</div>
          <div className="py-1 text-4xl font-bold tabular-nums">{moeda(total)}</div>
          <div className="text-sm text-slate-300">{pendentes.length} leitura(s) em {lista.length} ponto(s)</div>
        </div>
      )}
      {pendentes?.length === 0 && <Aviso tom="ok">Nenhum pagamento pendente. Todos os pontos estão em dia.</Aviso>}

      {lista.map((g) => (
        <Cartao key={g.nome}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{g.nome}</h2>
            <span className="text-lg font-bold tabular-nums">{moeda(g.total)}</span>
          </div>
          {g.leituras.map((l) => (
            <Link key={l.id} to={`/leituras/${l.id}`} className="flex min-h-12 items-center justify-between gap-2 border-t border-slate-100 py-2">
              <span>Leitura de {dataHora(l.dataHora)}</span>
              <span className="font-semibold tabular-nums">{moeda(l.partePonto)} ›</span>
            </Link>
          ))}
        </Cartao>
      ))}
    </Tela>
  );
}
