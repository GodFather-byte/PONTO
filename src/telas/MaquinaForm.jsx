// Cadastro / edição de máquina (Admin). Trocar o ponto aqui mantém todo o histórico.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { paraNumero, numero, dataHora } from '../lib/formato.js';
import { Tela, Cartao, Campo, CampoValor, Selecao, Botao, Marcador, Aviso, Linha } from '../componentes/ui.jsx';

const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export default function MaquinaForm() {
  const { id } = useParams();
  const novo = id === 'novo';
  const navegar = useNavigate();
  const [pontos, setPontos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [f, setF] = useState(novo ? { codigo: '', nome_jogo: '', ponto_id: '', inicialEntrada: '0', inicialSaida: '0', data_instalacao: hoje(), ativa: true } : null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e?.target ? e.target.value : e });

  useEffect(() => {
    supabase.from('pontos').select('id, nome').order('nome').then(({ data }) => setPontos(data ?? []));
    if (novo) return;
    supabase.from('maquinas').select('*').eq('id', id).single()
      .then(({ data, error }) => (error ? setErro(error.message) : setF({ ...data, ponto_id: data.ponto_id ?? '' })));
    supabase.from('maquina_movimentacoes').select('*, origem:pontos!ponto_origem(nome), destino:pontos!ponto_destino(nome)')
      .eq('maquina_id', id).order('movido_em', { ascending: false }).then(({ data }) => setMovs(data ?? []));
  }, [id]);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    const linha = {
      codigo: f.codigo.trim(), nome_jogo: f.nome_jogo.trim(), ponto_id: f.ponto_id || null,
      data_instalacao: f.data_instalacao, ativa: f.ativa,
    };
    if (novo) {
      linha.leitura_inicial_entrada = paraNumero(f.inicialEntrada);
      linha.leitura_inicial_saida = paraNumero(f.inicialSaida);
      if (linha.leitura_inicial_entrada === null || linha.leitura_inicial_saida === null) return setErro('Informe as leituras iniciais.');
    }
    setOcupado(true);
    const { error } = novo ? await supabase.from('maquinas').insert(linha) : await supabase.from('maquinas').update(linha).eq('id', id);
    setOcupado(false);
    if (error) setErro(error.code === '23505' ? 'Já existe uma máquina com este código.' : error.message);
    else navegar('/maquinas');
  }

  if (!f) return <Tela titulo="Máquina" voltar="/maquinas"><Aviso tom="erro">{erro}</Aviso></Tela>;
  return (
    <Tela titulo={novo ? 'Nova máquina' : 'Editar máquina'} voltar="/maquinas">
      <form onSubmit={salvar} className="space-y-4">
        <Cartao className="space-y-4">
          <Campo rotulo="Número / código" value={f.codigo} onChange={mudar('codigo')} required />
          <Campo rotulo="Nome do jogo" value={f.nome_jogo} onChange={mudar('nome_jogo')} />
          <Selecao rotulo="Ponto onde está" value={f.ponto_id} onChange={mudar('ponto_id')}>
            <option value="">Em estoque (sem ponto)</option>
            {pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Selecao>
          <Campo rotulo="Data de instalação" type="date" value={f.data_instalacao} onChange={mudar('data_instalacao')} required />
          <Marcador rotulo="Máquina ativa" checked={f.ativa} onChange={mudar('ativa')} />
        </Cartao>

        {novo ? (
          <Cartao className="grid grid-cols-2 gap-3">
            <CampoValor rotulo="Leitura inicial — entrada" value={f.inicialEntrada} onChange={mudar('inicialEntrada')} />
            <CampoValor rotulo="Leitura inicial — saída" value={f.inicialSaida} onChange={mudar('inicialSaida')} />
          </Cartao>
        ) : (
          <Cartao>
            <Linha rotulo="Leitura inicial (entrada / saída)" valor={`${numero(f.leitura_inicial_entrada)} / ${numero(f.leitura_inicial_saida)}`} />
            <Linha rotulo="Última leitura (entrada / saída)" valor={`${numero(f.entrada_atual)} / ${numero(f.saida_atual)}`} />
          </Cartao>
        )}

        <Aviso tom="erro">{erro}</Aviso>
        <Botao type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Botao>
      </form>

      {movs.length > 0 && (
        <Cartao>
          <h2 className="mb-2 font-semibold">Histórico de pontos</h2>
          {movs.map((m) => (
            <div key={m.id} className="border-t border-slate-100 py-2 text-sm">
              <span className="text-slate-500">{dataHora(m.movido_em)}</span><br />
              {m.origem?.nome ?? 'Estoque'} → {m.destino?.nome ?? 'Estoque'}
            </div>
          ))}
        </Cartao>
      )}
    </Tela>
  );
}
