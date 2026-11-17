// ÁREA DO DONO DO PONTO — detalhe de uma leitura, com o botão "Conferido".
// O dono não altera nada: a única ação é confirmar que conferiu (grava data e hora).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { buscarLeitura } from '../lib/leituras.js';
import { moeda, numero, dataHora, percentual, nomeCategoria, REGRAS } from '../lib/formato.js';
import { Tela, Cartao, Botao, Aviso, Linha } from '../componentes/ui.jsx';
import FotoContador from '../componentes/FotoContador.jsx';

export default function DonoLeitura() {
  const { id } = useParams();
  const [l, setL] = useState(undefined);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { buscarLeitura(id).then(setL); }, [id]);

  async function conferir() {
    setOcupado(true); setErro('');
    const { data, error } = await supabase.rpc('conferir_leitura', { p_leitura: id });
    setOcupado(false);
    if (error) setErro(error.message); else setL({ ...l, conferidoEm: data });
  }

  if (l === undefined) return <Tela titulo="Leitura" voltar="/"><Cartao>Carregando…</Cartao></Tela>;
  if (l === null) return <Tela titulo="Leitura" voltar="/"><Cartao>Leitura não encontrada.</Cartao></Tela>;

  return (
    <Tela titulo={`Leitura de ${dataHora(l.dataHora)}`} voltar="/">
      <div className="rounded-xl bg-slate-900 p-4 text-center text-white shadow">
        <div className="text-sm font-semibold tracking-wide">SUA PARTE ({percentual(l.percentual)})</div>
        <div className="py-1 text-4xl font-bold tabular-nums">{moeda(l.partePonto)}</div>
        <div className="text-sm text-slate-300">{l.pontoPago ? 'Paga na hora da leitura' : 'A receber'}</div>
      </div>

      <Cartao>
        <Linha rotulo="Ponto" valor={l.pontoNome} />
        <Linha rotulo="Leitura feita por" valor={l.operadorNome || '—'} />
        <div className="my-2 border-t border-slate-200" />
        <Linha rotulo="Total entrada" valor={moeda(l.totalEntrada)} />
        <Linha rotulo="Total saída" valor={moeda(l.totalSaida)} />
        <Linha rotulo="Resultado" valor={moeda(l.resultado)} forte />
        <Linha rotulo="Despesas" valor={moeda(l.totalDespesas)} />
        <div className="pt-1 text-xs text-slate-500">Regra de despesa: {REGRAS[l.regra]}</div>
      </Cartao>

      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Máquinas</h2>
      {l.maquinas.map((m) => (
        <Cartao key={m.maquinaId}>
          <div className="mb-1 font-semibold">{m.codigo} · {m.nomeJogo}{m.zerado ? ' · contador zerado' : ''}</div>
          <Linha rotulo={`Entrada (${numero(m.entradaAnterior)} → ${numero(m.entradaAtual)})`} valor={moeda(m.entrada)} />
          <Linha rotulo={`Saída (${numero(m.saidaAnterior)} → ${numero(m.saidaAtual)})`} valor={moeda(m.saida)} />
          <Linha rotulo="Resultado" valor={moeda(m.resultado)} forte />
          <FotoContador caminho={m.fotoCaminho} />
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

      {l.observacao && <Cartao>Obs.: {l.observacao}</Cartao>}

      <Aviso tom="erro">{erro}</Aviso>
      {l.conferidoEm
        ? <Aviso tom="ok"><span className="text-base font-semibold">✓ Conferido em {dataHora(l.conferidoEm)}</span></Aviso>
        : <Botao onClick={conferir} disabled={ocupado} className="min-h-16 text-xl">{ocupado ? 'Registrando…' : 'Conferido'}</Botao>}
    </Tela>
  );
}
