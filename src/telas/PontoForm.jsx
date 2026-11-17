// Cadastro / edição de ponto (Admin)
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { paraNumero, paraCampo, REGRAS } from '../lib/formato.js';
import { Tela, Cartao, Campo, CampoValor, Botao, Marcador, Aviso } from '../componentes/ui.jsx';

const VAZIO = { nome: '', endereco: '', telefone: '', percentual: '', regra_despesa: 'antes_da_divisao', observacoes: '', ativo: true };

export default function PontoForm() {
  const { id } = useParams();
  const novo = id === 'novo';
  const navegar = useNavigate();
  const [f, setF] = useState(novo ? VAZIO : null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e?.target ? e.target.value : e });

  useEffect(() => {
    if (novo) return;
    supabase.from('pontos').select('*').eq('id', id).single()
      .then(({ data, error }) => (error ? setErro(error.message) : setF({ ...data, percentual: paraCampo(data.percentual_ponto) })));
  }, [id]);

  async function salvar(e) {
    e.preventDefault();
    const percentual = paraNumero(f.percentual);
    if (percentual === null || percentual > 100) return setErro('A % do estabelecimento deve ficar entre 0 e 100.');
    setOcupado(true); setErro('');
    const linha = {
      nome: f.nome.trim(), endereco: f.endereco.trim(), telefone: f.telefone.replace(/\D/g, ''),
      percentual_ponto: percentual, regra_despesa: f.regra_despesa, observacoes: f.observacoes, ativo: f.ativo,
    };
    const { error } = novo ? await supabase.from('pontos').insert(linha) : await supabase.from('pontos').update(linha).eq('id', id);
    setOcupado(false);
    if (error) setErro(error.message); else navegar('/pontos');
  }

  if (!f) return <Tela titulo="Ponto" voltar="/pontos"><Aviso tom="erro">{erro}</Aviso></Tela>;
  return (
    <Tela titulo={novo ? 'Novo ponto' : 'Editar ponto'} voltar="/pontos">
      <form onSubmit={salvar} className="space-y-4">
        <Cartao className="space-y-4">
          <Campo rotulo="Nome do ponto" value={f.nome} onChange={mudar('nome')} required />
          <Campo rotulo="Endereço" value={f.endereco} onChange={mudar('endereco')} />
          <Campo rotulo="WhatsApp do responsável (com DDD)" inputMode="tel" placeholder="11999998888"
            value={f.telefone} onChange={mudar('telefone')} />
          <CampoValor rotulo="% do estabelecimento (0 a 100)" value={f.percentual} onChange={mudar('percentual')} required />
        </Cartao>

        <Cartao className="space-y-1">
          <div className="text-sm font-medium text-slate-600">Regra de despesa</div>
          {Object.entries(REGRAS).map(([valor, texto]) => (
            <label key={valor} className="flex min-h-12 items-center gap-3">
              <input type="radio" name="regra" className="h-6 w-6 accent-emerald-600"
                checked={f.regra_despesa === valor} onChange={() => mudar('regra_despesa')(valor)} />
              {texto}
            </label>
          ))}
        </Cartao>

        <Cartao className="space-y-3">
          <label className="block text-sm font-medium text-slate-600">
            Observações
            <textarea rows={3} value={f.observacoes} onChange={mudar('observacoes')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <Marcador rotulo="Ponto ativo" checked={f.ativo} onChange={mudar('ativo')} />
        </Cartao>

        <Aviso tom="erro">{erro}</Aviso>
        <Botao type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Tela>
  );
}
