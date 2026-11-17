// Detalhe de uma leitura salva (ou ainda na fila do aparelho)
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useSessao } from '../lib/sessao.jsx';
import { buscarLeitura } from '../lib/leituras.js';
import { aoMudarFila, sincronizar, removerDaFila } from '../lib/fila.js';
import { moeda, numero, dataHora, nomeCategoria } from '../lib/formato.js';
import { Tela, Cartao, Botao, Aviso, Linha } from '../componentes/ui.jsx';
import Divisao, { Diferenca } from '../componentes/Divisao.jsx';

// Abre a foto do contador (o bucket é privado, então gera um link temporário)
async function abrirFoto(caminho) {
  const { data, error } = await supabase.storage.from('contadores').createSignedUrl(caminho, 300);
  if (error) window.alert('Foto ainda não disponível (pode estar esperando envio).');
  else window.open(data.signedUrl, '_blank');
}

export default function LeituraDetalhe() {
  const { id } = useParams();
  const { perfil } = useSessao();
  const navegar = useNavigate();
  const [l, setL] = useState(undefined);
  const [alteracoes, setAlteracoes] = useState([]);

  useEffect(() => {
    const carregar = () => buscarLeitura(id).then(setL);
    carregar();
    return aoMudarFila(carregar);
  }, [id]);

  // Histórico de alterações: só o Admin enxerga
  useEffect(() => {
    if (perfil.papel !== 'admin') return;
    supabase.from('leitura_alteracoes').select('id, alterado_em, motivo, perfis(nome)')
      .eq('leitura_id', id).order('alterado_em', { ascending: false }).then(({ data }) => setAlteracoes(data ?? []));
  }, [id]);

  if (l === undefined) return <Tela titulo="Leitura" voltar="/leituras"><Cartao>Carregando…</Cartao></Tela>;
  if (l === null) return <Tela titulo="Leitura" voltar="/leituras"><Cartao>Leitura não encontrada.</Cartao></Tela>;

  async function descartar() {
    if (window.confirm('Apagar esta leitura do aparelho? Ela NÃO foi enviada e será perdida.')) {
      await removerDaFila(l.id);
      navegar('/leituras', { replace: true });
    }
  }

  return (
    <Tela titulo={l.pontoNome} voltar="/leituras">
      {l.erro ? (
        <Aviso tom="erro">
          <div className="font-semibold">O servidor recusou esta leitura:</div>{l.erro}
          <div className="mt-2 flex gap-2">
            <button onClick={sincronizar} className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white">Tentar de novo</button>
            <button onClick={descartar} className="rounded-lg border border-red-300 px-3 py-2 font-semibold">Descartar</button>
          </div>
        </Aviso>
      ) : l.pendente ? (
        <Aviso>
          Leitura guardada no aparelho. Será enviada sozinha quando houver internet.
          <button onClick={sincronizar} className="ml-2 font-semibold underline">Enviar agora</button>
        </Aviso>
      ) : (
        <Aviso tom="ok">Leitura salva.{l.conferidoEm && ` Conferida pelo ponto em ${dataHora(l.conferidoEm)}.`}</Aviso>
      )}

      <Cartao>
        <Linha rotulo="Data" valor={dataHora(l.dataHora)} />
        <Linha rotulo="Leitura feita por" valor={l.operadorNome || '—'} />
      </Cartao>

      {l.maquinas.map((m) => (
        <Cartao key={m.maquinaId}>
          <div className="mb-1 font-semibold">{m.codigo} · {m.nomeJogo}{m.zerado ? ' · contador zerado' : ''}</div>
          <Linha rotulo={`Entrada (${numero(m.entradaAnterior)} → ${numero(m.entradaAtual)})`} valor={moeda(m.entrada)} />
          <Linha rotulo={`Saída (${numero(m.saidaAnterior)} → ${numero(m.saidaAtual)})`} valor={moeda(m.saida)} />
          <Linha rotulo="Resultado" valor={moeda(m.resultado)} forte />
          {m.fotoCaminho && (
            <button onClick={() => abrirFoto(m.fotoCaminho)} className="pt-1 font-medium text-emerald-700 underline">📷 Ver foto do contador</button>
          )}
        </Cartao>
      ))}

      {l.despesas.length > 0 && (
        <Cartao>
          <h2 className="mb-1 font-semibold">Despesas</h2>
          {l.despesas.map((d, i) => (
            <Linha key={i} rotulo={`${d.descricao} (${nomeCategoria(d.categoria)})`} valor={moeda(d.valor)} />
          ))}
        </Cartao>
      )}

      <Divisao c={l} percentual={l.percentual} regra={l.regra} pontoPago={l.pontoPago} />

      <Cartao className="space-y-2">
        <Linha rotulo="Parte do ponto" valor={l.pontoPago ? 'Paga na hora' : 'A pagar'} />
        <Linha rotulo="Valor recolhido" valor={l.recolhido === null ? 'Não informado' : moeda(l.recolhido)} forte />
        <Diferenca valor={l.diferenca} />
        {l.observacao && <p className="pt-1 text-slate-700">Obs.: {l.observacao}</p>}
      </Cartao>

      {perfil.papel === 'admin' && !l.pendente && (
        <Botao cor="claro" onClick={() => navegar(`/leituras/${l.id}/editar`)}>Editar leitura</Botao>
      )}

      {alteracoes.length > 0 && (
        <Cartao>
          <h2 className="mb-1 font-semibold">Histórico de alterações</h2>
          {alteracoes.map((a) => (
            <div key={a.id} className="border-t border-slate-100 py-2 text-sm">
              <span className="text-slate-500">{dataHora(a.alterado_em)} · {a.perfis?.nome}</span><br />{a.motivo}
            </div>
          ))}
        </Cartao>
      )}

      <Botao onClick={() => navegar('/leitura')}>Nova leitura</Botao>
    </Tela>
  );
}
