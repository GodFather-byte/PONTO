// MANUTENÇÃO — lista das máquinas com o status de cada uma (as com problema aparecem primeiro).
// Admin vê todas; operador vê as dos pontos dele.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { STATUS } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

const ORDEM = { parada: 0, com_defeito: 1, funcionando: 2 };

export default function Manutencao() {
  const [maquinas, setMaquinas] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    supabase.from('maquinas').select('id, codigo, nome_jogo, status, ativa, pontos(nome)').eq('ativa', true).order('codigo')
      .then(({ data, error }) => (error ? setErro(error.message) : setMaquinas(data)));
  }, []);

  const lista = [...(maquinas ?? [])].sort((a, b) => ORDEM[a.status] - ORDEM[b.status]);
  const comProblema = lista.filter((m) => m.status !== 'funcionando').length;

  return (
    <Tela titulo="Manutenção" voltar="/">
      <Aviso tom="erro">{erro}</Aviso>
      {!maquinas && !erro && <Cartao>Carregando…</Cartao>}
      {maquinas && (comProblema > 0
        ? <Aviso>{comProblema} máquina(s) com defeito ou parada(s).</Aviso>
        : <Aviso tom="ok">Todas as máquinas estão funcionando.</Aviso>)}
      {lista.map((m) => (
        <Link key={m.id} to={`/manutencao/${m.id}`} className="block">
          <Cartao className="flex items-center justify-between gap-3 active:bg-slate-50">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{m.codigo} · {m.nome_jogo}</div>
              <div className="text-sm text-slate-500">{m.pontos?.nome ?? 'Em estoque'}</div>
            </div>
            <span className={`shrink-0 rounded px-2 py-1 text-sm font-semibold ${STATUS[m.status].classe}`}>
              {STATUS[m.status].icone} {STATUS[m.status].texto}
            </span>
          </Cartao>
        </Link>
      ))}
    </Tela>
  );
}
