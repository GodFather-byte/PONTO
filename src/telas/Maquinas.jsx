// Lista de máquinas agrupadas por ponto (Admin)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { numero, STATUS } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Maquinas() {
  const [maquinas, setMaquinas] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('maquinas').select('*, pontos(nome)').order('codigo')
      .then(({ data, error }) => (error ? setErro(error.message) : setMaquinas(data)));
  }, []);

  // Agrupa pelo nome do ponto ("Em estoque" quando não está em nenhum)
  const grupos = {};
  for (const m of maquinas ?? []) (grupos[m.pontos?.nome ?? 'Em estoque (sem ponto)'] ??= []).push(m);

  return (
    <Tela titulo="Máquinas" voltar="/"
      acao={<Link to="/maquinas/novo" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold">+ Nova</Link>}>
      <Aviso tom="erro">{erro}</Aviso>
      {maquinas?.length === 0 && <Cartao>Nenhuma máquina cadastrada. Toque em "+ Nova".</Cartao>}
      {Object.keys(grupos).sort().map((nome) => (
        <section key={nome} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{nome}</h2>
          {grupos[nome].map((m) => (
            <Link key={m.id} to={`/maquinas/${m.id}`} className="block">
              <Cartao className={m.ativa ? '' : 'opacity-60'}>
                <div className="text-lg font-semibold">{m.codigo} · {m.nome_jogo}{m.ativa ? '' : ' (inativa)'}</div>
                {m.status !== 'funcionando' && STATUS[m.status] && (
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS[m.status].classe}`}>{STATUS[m.status].icone} {STATUS[m.status].texto}</span>
                )}
                <div className="text-sm text-slate-600 tabular-nums">
                  Entrada {numero(m.entrada_atual)} · Saída {numero(m.saida_atual)}
                </div>
              </Cartao>
            </Link>
          ))}
        </section>
      ))}
    </Tela>
  );
}
