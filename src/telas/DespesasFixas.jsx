// DESPESAS FIXAS (Admin): salário, aluguel etc. de cada ponto, com valor e dia do mês.
// Cada uma entra sozinha, uma vez por mês, na primeira leitura do ponto a partir do dia de vencimento.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { moeda, paraNumero, paraCampo, CATEGORIAS, nomeCategoria } from '../lib/formato.js';
import { Tela, Cartao, Campo, CampoValor, Selecao, Botao, Marcador, Aviso } from '../componentes/ui.jsx';

const VAZIA = { id: null, ponto_id: '', descricao: '', categoria: 'salario', valor: '', dia: '5', ativa: true };

export default function DespesasFixas() {
  const [pontos, setPontos] = useState([]);
  const [lista, setLista] = useState(null);
  const [f, setF] = useState(null);          // despesa em edição (null = formulário fechado)
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e?.target ? e.target.value : e });

  async function carregar() {
    const [p, d] = await Promise.all([
      supabase.from('pontos').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('despesas_fixas').select('*, pontos(nome)').order('descricao'),
    ]);
    if (p.error || d.error) return setErro((p.error || d.error).message);
    setPontos(p.data); setLista(d.data);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e) {
    e.preventDefault(); setErro('');
    const valor = paraNumero(f.valor), dia = parseInt(f.dia, 10);
    if (!f.ponto_id) return setErro('Escolha o ponto.');
    if (!valor) return setErro('Informe um valor maior que zero.');
    if (!(dia >= 1 && dia <= 31)) return setErro('O dia do mês deve ficar entre 1 e 31.');
    const linha = { ponto_id: f.ponto_id, descricao: f.descricao.trim(), categoria: f.categoria, valor, dia_do_mes: dia, ativa: f.ativa };
    const { error } = f.id ? await supabase.from('despesas_fixas').update(linha).eq('id', f.id) : await supabase.from('despesas_fixas').insert(linha);
    if (error) return setErro(error.message);
    setF(null); carregar();
  }

  // Agrupa por ponto
  const grupos = {};
  for (const d of lista ?? []) (grupos[d.pontos?.nome ?? '—'] ??= []).push(d);

  return (
    <Tela titulo="Despesas fixas" voltar="/"
      acao={!f && <button onClick={() => { setErro(''); setF(VAZIA); }} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold">+ Nova</button>}>
      <Aviso tom="ok">
        Cada despesa entra sozinha, uma vez por mês, na primeira leitura do ponto feita a partir do dia de vencimento.
        Ela é descontada conforme a regra de despesa do ponto, e o operador vê a linha já preenchida.
      </Aviso>

      {f && (
        <form onSubmit={salvar}>
          <Cartao className="space-y-3 border-2 border-emerald-600">
            <h2 className="font-semibold">{f.id ? 'Editar despesa fixa' : 'Nova despesa fixa'}</h2>
            <Selecao rotulo="Ponto" value={f.ponto_id} onChange={mudar('ponto_id')}>
              <option value="">Escolha…</option>
              {pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
            <Campo rotulo="Descrição (ex.: Salário do atendente)" value={f.descricao} onChange={mudar('descricao')} required />
            <div className="grid grid-cols-2 gap-3">
              <CampoValor rotulo="Valor (R$)" value={f.valor} onChange={mudar('valor')} />
              <Campo rotulo="Dia do mês" inputMode="numeric" value={f.dia} onChange={mudar('dia')} />
            </div>
            <Selecao rotulo="Categoria" value={f.categoria} onChange={mudar('categoria')}>
              {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selecao>
            <Marcador rotulo="Ativa" checked={f.ativa} onChange={mudar('ativa')} />
            <Aviso tom="erro">{erro}</Aviso>
            <Botao type="submit">Salvar</Botao>
            <Botao cor="claro" onClick={() => setF(null)}>Cancelar</Botao>
          </Cartao>
        </form>
      )}
      {!f && <Aviso tom="erro">{erro}</Aviso>}

      {lista?.length === 0 && !f && <Cartao>Nenhuma despesa fixa cadastrada. Toque em "+ Nova".</Cartao>}
      {Object.keys(grupos).sort().map((nome) => (
        <section key={nome} className="space-y-2">
          <h2 className="flex items-baseline justify-between px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span>{nome}</span>
            <span className="normal-case tabular-nums">{moeda(grupos[nome].filter((d) => d.ativa).reduce((s, d) => s + Number(d.valor), 0))}/mês</span>
          </h2>
          {grupos[nome].map((d) => (
            <button key={d.id} className="block w-full text-left"
              onClick={() => { setErro(''); setF({ ...d, valor: paraCampo(d.valor), dia: String(d.dia_do_mes) }); window.scrollTo(0, 0); }}>
              <Cartao className={d.ativa ? '' : 'opacity-60'}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{d.descricao}</span>
                  <span className="font-bold tabular-nums">{moeda(d.valor)}</span>
                </div>
                <div className="text-sm text-slate-500">Todo dia {d.dia_do_mes} · {nomeCategoria(d.categoria)}{d.ativa ? '' : ' · Inativa'}</div>
              </Cartao>
            </button>
          ))}
        </section>
      ))}
    </Tela>
  );
}
