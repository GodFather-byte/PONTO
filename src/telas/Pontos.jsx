// Lista de pontos (Admin)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { numero, REGRAS } from '../lib/formato.js';
import { Tela, Cartao, Aviso } from '../componentes/ui.jsx';

export default function Pontos() {
  const [pontos, setPontos] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('pontos').select('*').order('ativo', { ascending: false }).order('nome')
      .then(({ data, error }) => (error ? setErro(error.message) : setPontos(data)));
  }, []);

  return (
    <Tela titulo="Pontos" voltar="/"
      acao={<Link to="/pontos/novo" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold">+ Novo</Link>}>
      <Aviso tom="erro">{erro}</Aviso>
      {pontos?.length === 0 && <Cartao>Nenhum ponto cadastrado. Toque em "+ Novo".</Cartao>}
      {pontos?.map((p) => (
        <Link key={p.id} to={`/pontos/${p.id}`} className="block">
          <Cartao className={p.ativo ? '' : 'opacity-60'}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold">{p.nome}</span>
              <span className="font-semibold tabular-nums">{numero(p.percentual_ponto)}%</span>
            </div>
            <div className="text-sm text-slate-600">{p.endereco}</div>
            <div className="text-sm text-slate-500">{REGRAS[p.regra_despesa]}{p.ativo ? '' : ' · Inativo'}</div>
          </Cartao>
        </Link>
      ))}
    </Tela>
  );
}
