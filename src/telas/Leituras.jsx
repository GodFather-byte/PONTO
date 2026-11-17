// Lista das últimas leituras (as que ainda estão só no aparelho aparecem primeiro)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listarLeituras } from '../lib/leituras.js';
import { aoMudarFila } from '../lib/fila.js';
import { moeda, dataHora } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Leituras() {
  const [r, setR] = useState(null);
  const [filtro, setFiltro] = useState('todas'); // todas | pendentes | conferidas
  useEffect(() => {
    const carregar = () => listarLeituras().then(setR);
    carregar();
    return aoMudarFila(carregar);
  }, []);

  const visiveis = r?.leituras.filter((l) =>
    filtro === 'todas' || (filtro === 'conferidas' ? Boolean(l.conferidoEm) : !l.conferidoEm));

  return (
    <Tela titulo="Leituras" voltar="/">
      {r?.offline && <Aviso>Sem internet: mostrando só as leituras guardadas neste aparelho.</Aviso>}
      {!r && <Cartao>Carregando…</Cartao>}
      <div className="grid grid-cols-3 gap-2">
        {[['todas', 'Todas'], ['pendentes', 'A conferir'], ['conferidas', 'Conferidas']].map(([valor, texto]) => (
          <button key={valor} onClick={() => setFiltro(valor)}
            className={`min-h-11 rounded-lg text-sm font-semibold ${filtro === valor ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}>
            {texto}
          </button>
        ))}
      </div>
      {visiveis?.length === 0 && <Cartao>Nenhuma leitura aqui.</Cartao>}
      {visiveis?.map((l) => (
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
              {l.conferidoEm && <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">Conferido em {dataHora(l.conferidoEm)}</span>}
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
