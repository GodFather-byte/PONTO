// PROSPECÇÃO (Admin): lugares que podem virar pontos. Ao marcar "Fechado", vira ponto cadastrado.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { paraNumero, paraCampo, percentual } from '../lib/formato.js';
import { Tela, Cartao, Campo, CampoValor, Botao, Aviso } from '../componentes/ui.jsx';

const STATUS = {
  contato_feito: { texto: 'Contato feito', classe: 'bg-slate-200 text-slate-800' },
  negociando:    { texto: 'Negociando',    classe: 'bg-amber-100 text-amber-900' },
  fechado:       { texto: 'Fechado',       classe: 'bg-emerald-100 text-emerald-900' },
  recusado:      { texto: 'Recusado',      classe: 'bg-red-100 text-red-800' },
};
const VAZIO = { id: null, nome: '', endereco: '', contato: '', status: 'contato_feito', pct: '', observacoes: '', ponto_id: null };

export default function Prospeccao() {
  const navegar = useNavigate();
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState('abertos');
  const [f, setF] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e?.target ? e.target.value : e });

  async function carregar() {
    const { data, error } = await supabase.from('prospectos').select('*').order('atualizado_em', { ascending: false });
    if (error) setErro(error.message); else setLista(data);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault(); setErro('');
    const pct = f.pct === '' ? null : paraNumero(f.pct);
    if (f.pct !== '' && (pct === null || pct > 100)) return setErro('A % proposta deve ficar entre 0 e 100.');
    const fechar = f.status === 'fechado' && !f.ponto_id;
    if (fechar && !window.confirm(`Marcar como Fechado cria o ponto "${f.nome}" no cadastro, com ${percentual(pct ?? 0)} para o estabelecimento. Continuar?`)) return;
    setOcupado(true);
    // "Fechado" só é gravado pela conversão, para o ponto nunca ficar sem ser criado
    const linha = { nome: f.nome.trim(), endereco: f.endereco.trim(), contato: f.contato.trim(), percentual_proposto: pct,
      observacoes: f.observacoes, status: fechar ? 'negociando' : f.status, atualizado_em: new Date().toISOString() };
    const r = f.id ? await supabase.from('prospectos').update(linha).eq('id', f.id).select('id').single()
                   : await supabase.from('prospectos').insert(linha).select('id').single();
    if (r.error) { setOcupado(false); return setErro(r.error.message); }
    if (fechar) {
      const c = await supabase.rpc('converter_prospecto', { p_id: r.data.id });
      setOcupado(false);
      if (c.error) return setErro(c.error.message);
      return navegar(`/pontos/${c.data}`);   // abre o ponto novo para completar o cadastro
    }
    setOcupado(false); setF(null); carregar();
  }

  const visiveis = (lista ?? []).filter((p) => filtro === 'todos' || (filtro === 'abertos' ? ['contato_feito', 'negociando'].includes(p.status) : p.status === filtro));

  return (
    <Tela titulo="Novos pontos" voltar="/"
      acao={!f && <button onClick={() => { setErro(''); setF(VAZIO); }} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold">+ Novo</button>}>
      {f ? (
        <form onSubmit={salvar}>
          <Cartao className="space-y-3 border-2 border-emerald-600">
            <h2 className="font-semibold">{f.id ? 'Editar' : 'Novo lugar'}</h2>
            <Campo rotulo="Nome do lugar" value={f.nome} onChange={mudar('nome')} required />
            <Campo rotulo="Endereço" value={f.endereco} onChange={mudar('endereco')} />
            <Campo rotulo="Contato (nome e telefone)" value={f.contato} onChange={mudar('contato')} />
            <CampoValor rotulo="% proposta para o estabelecimento" value={f.pct} onChange={mudar('pct')} />
            <div>
              <div className="text-sm font-medium text-slate-600">Status</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {Object.entries(STATUS).map(([v, s]) => (
                  <button key={v} type="button" disabled={Boolean(f.ponto_id)} onClick={() => mudar('status')(v)}
                    className={`min-h-12 rounded-lg text-sm font-semibold disabled:opacity-60 ${f.status === v ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}>
                    {s.texto}
                  </button>
                ))}
              </div>
              {f.status === 'fechado' && !f.ponto_id && <p className="pt-2 text-sm text-emerald-800">Ao salvar, este lugar vira um ponto cadastrado.</p>}
              {f.ponto_id && <p className="pt-2 text-sm text-slate-600">Este lugar já virou ponto cadastrado.</p>}
            </div>
            <label className="block text-sm font-medium text-slate-600">
              Observações
              <textarea rows={3} value={f.observacoes} onChange={mudar('observacoes')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <Aviso tom="erro">{erro}</Aviso>
            <Botao type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Botao>
            {f.ponto_id && <Botao cor="escuro" onClick={() => navegar(`/pontos/${f.ponto_id}`)}>Abrir o ponto</Botao>}
            <Botao cor="claro" onClick={() => setF(null)}>Cancelar</Botao>
          </Cartao>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[['abertos', 'Abertos'], ['fechado', 'Fechados'], ['recusado', 'Recusados'], ['todos', 'Todos']].map(([v, t]) => (
              <button key={v} onClick={() => setFiltro(v)}
                className={`min-h-11 rounded-lg text-sm font-semibold ${filtro === v ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}>{t}</button>
            ))}
          </div>
          <Aviso tom="erro">{erro}</Aviso>
          {lista && visiveis.length === 0 && <Cartao>Nenhum lugar nesta lista. Toque em "+ Novo".</Cartao>}
          {visiveis.map((p) => (
            <button key={p.id} className="block w-full text-left" onClick={() => { setErro(''); setF({ ...p, pct: paraCampo(p.percentual_proposto) }); }}>
              <Cartao>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold">{p.nome}</span>
                  <span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${STATUS[p.status].classe}`}>{STATUS[p.status].texto}</span>
                </div>
                <div className="text-sm text-slate-600">{p.endereco}</div>
                <div className="text-sm text-slate-500">
                  {[p.contato, p.percentual_proposto !== null && `${percentual(p.percentual_proposto)} proposto`].filter(Boolean).join(' · ')}
                </div>
              </Cartao>
            </button>
          ))}
        </>
      )}
    </Tela>
  );
}
