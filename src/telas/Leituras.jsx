// Lista das últimas leituras (as que ainda estão só no aparelho aparecem primeiro)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarLeituras } from '../lib/leituras.js';
import { aoMudarFila } from '../lib/fila.js';
import { moeda, dataHora } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Leituras() {
  const [r, setR] = useState(null);
  useEffect(() => {
    const carregar = () => listarLeituras().then(setR);
    carregar();
    return aoMudarFila(carregar);
  }, []);

  return (
    <Tela titulo="Leituras" voltar="/">
      {r?.offline && <Aviso>Sem internet: mostrando só as leituras guardadas neste aparelho.</Aviso>}
      {!r && <Cartao>Carregando…</Cartao>}
      {r?.leituras.length === 0 && <Cartao>Nenhuma leitura ainda.</Cartao>}
      {r?.leituras.map((l) => (
        <Link key={l.id} to={`/leituras/${l.id}`} className="block">
          <Cartao>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold">{l.pontoNome}</span>
              <span className="font-bold tabular-nums">{moeda(l.resultado)}</span>
            </div>
            <div className="text-sm text-slate-600">{dataHora(l.dataHora)} · {l.operadorNome}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
              {l.pendente && !l.erro && <span className="rounded bg-amber-100 px-2 py-1 text-amber-900">Aguardando envio</span>}
              {l.erro && <span className="rounded bg-red-100 px-2 py-1 text-red-800">Erro no envio</span>}
              {l.conferidoEm && <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">Conferido</span>}
              {l.diferenca !== null && l.diferenca !== 0 && (
                <span className="rounded bg-red-100 px-2 py-1 text-red-800">Diferença {moeda(l.diferenca)}</span>
              )}
            </div>
          </Cartao>
        </Link>
      ))}
    </Tela>
  );
}
