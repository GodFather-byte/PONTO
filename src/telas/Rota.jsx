// ROTA DO DIA: escolhe os pontos a visitar e abre a rota no Google Maps.
// Pontos com leitura atrasada aparecem primeiro e já vêm marcados.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { hojeSP, diasEntre, dataBR } from '../lib/painel.js';
import { linkRota, MAX_PARADAS } from '../lib/rota.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Rota() {
  const [pontos, setPontos] = useState(null);   // já na ordem da rota
  const [marcados, setMarcados] = useState(new Set());
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const [cfg, p] = await Promise.all([
        supabase.from('configuracoes').select('dias_sem_leitura').maybeSingle(),
        supabase.from('pontos').select('id, nome, endereco, leituras(data_local)').eq('ativo', true).order('nome')
          .order('data_hora', { referencedTable: 'leituras', ascending: false }).limit(1, { referencedTable: 'leituras' }),
      ]);
      if (p.error) return setErro(p.error.message);
      const limite = cfg.data?.dias_sem_leitura ?? 7, hoje = hojeSP();
      const lista = p.data.map((x) => {
        const ultima = x.leituras[0]?.data_local ?? null;
        const dias = ultima ? diasEntre(ultima, hoje) : null;
        return { id: x.id, nome: x.nome, endereco: x.endereco, ultima, dias, atrasado: dias === null || dias > limite };
      }).sort((a, b) => (b.atrasado - a.atrasado) || ((b.dias ?? 9999) - (a.dias ?? 9999)) || a.nome.localeCompare(b.nome));
      setPontos(lista);
      setMarcados(new Set(lista.filter((x) => x.atrasado && x.endereco).slice(0, MAX_PARADAS).map((x) => x.id)));
    })();
  }, []);

  const alternar = (id) => { const s = new Set(marcados); s.has(id) ? s.delete(id) : s.add(id); setMarcados(s); };
  const mover = (i, passo) => {
    const l = [...pontos], j = i + passo;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; setPontos(l);
  };

  const escolhidos = (pontos ?? []).filter((p) => marcados.has(p.id));
  const link = linkRota(escolhidos.map((p) => p.endereco));
  const demais = escolhidos.length > MAX_PARADAS;

  return (
    <Tela titulo="Rota do dia" voltar="/">
      <Aviso tom="erro">{erro}</Aviso>
      {!pontos && !erro && <Cartao>Carregando…</Cartao>}
      {pontos && (
        <Aviso tom="ok">
          Marque os pontos e arrume a ordem com as setas. A rota abre no Google Maps saindo de onde você está, na ordem desta lista.
        </Aviso>
      )}
      {pontos?.map((p, i) => (
        <Cartao key={p.id} className={`flex items-center gap-3 ${marcados.has(p.id) ? 'border-2 border-emerald-600' : ''}`}>
          <input type="checkbox" className="h-7 w-7 shrink-0 accent-emerald-600" checked={marcados.has(p.id)} disabled={!p.endereco}
            onChange={() => alternar(p.id)} aria-label={`Visitar ${p.nome}`} />
          <div className="min-w-0 flex-1" onClick={() => p.endereco && alternar(p.id)}>
            <div className="font-semibold">{p.nome}</div>
            <div className="truncate text-sm text-slate-600">{p.endereco || 'Sem endereço cadastrado — não entra na rota'}</div>
            <div className={`text-sm font-medium ${p.atrasado ? 'text-red-700' : 'text-slate-500'}`}>
              {p.dias === null ? '⚠ Nunca teve leitura' : `${p.atrasado ? '⚠ Atrasado: ' : ''}última leitura há ${p.dias} dia(s) (${dataBR(p.ultima)})`}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="h-9 w-9 rounded-lg border border-slate-300 disabled:opacity-30">▲</button>
            <button onClick={() => mover(i, 1)} disabled={i === pontos.length - 1} aria-label="Descer" className="h-9 w-9 rounded-lg border border-slate-300 disabled:opacity-30">▼</button>
          </div>
        </Cartao>
      ))}

      {pontos && (
        <div className="sticky bottom-0 space-y-2 bg-slate-100 pb-2 pt-3">
          {demais && <Aviso>O Google Maps aceita até {MAX_PARADAS} paradas por rota. Só as {MAX_PARADAS} primeiras marcadas entram.</Aviso>}
          {link ? (
            <a href={link} target="_blank" rel="noreferrer"
              className="flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-center text-lg font-semibold text-white shadow-sm active:bg-emerald-700">
              Abrir rota no Google Maps ({Math.min(escolhidos.length, MAX_PARADAS)} parada(s))
            </a>
          ) : (
            <div className="rounded-xl bg-slate-300 px-4 py-4 text-center font-semibold text-slate-600">Marque pelo menos um ponto com endereço</div>
          )}
        </div>
      )}
    </Tela>
  );
}
