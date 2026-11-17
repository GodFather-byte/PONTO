// ÁREA DO DONO DO PONTO — tela inicial (somente visualização).
// Mostra o resumo do mês e as leituras do ponto dele. O banco só entrega os pontos dele.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useSessao } from '../lib/sessao.jsx';
import { listarLeiturasDoMes, ultimosMeses, mesAtual } from '../lib/leituras.js';
import { moeda, dataHora, percentual } from '../lib/formato.js';
import { Tela, Cartao, Selecao, Aviso, Linha } from '../componentes/ui.jsx';

const soma = (lista, campo) => lista.reduce((s, l) => s + (l[campo] || 0), 0);

export default function DonoInicio() {
  const { perfil, sair } = useSessao();
  const [pontos, setPontos] = useState(null);
  const [pontoId, setPontoId] = useState(sessionStorage.getItem('dono-ponto') ?? '');
  const [mes, setMes] = useState(sessionStorage.getItem('dono-mes') ?? mesAtual());
  const [leituras, setLeituras] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.from('pontos').select('*').order('nome').then(({ data, error }) => {
      if (error) return setErro(error.message);
      setPontos(data);
      if (!data.some((p) => p.id === pontoId)) setPontoId(data[0]?.id ?? '');
    });
  }, []);

  useEffect(() => {
    if (!pontoId) return;
    sessionStorage.setItem('dono-ponto', pontoId); sessionStorage.setItem('dono-mes', mes); // lembra ao voltar do detalhe
    setLeituras(null);
    listarLeiturasDoMes(pontoId, mes).then(setLeituras).catch((e) => setErro(e.message));
  }, [pontoId, mes]);

  const ponto = pontos?.find((p) => p.id === pontoId);
  const aConferir = leituras?.filter((l) => !l.conferidoEm).length ?? 0;

  return (
    <Tela titulo={ponto?.nome ?? 'Meu ponto'}
      acao={<button onClick={sair} className="rounded-lg px-3 py-2 text-sm text-slate-300 underline">Sair</button>}>
      <p className="px-1 text-slate-600">Olá, {perfil.nome || perfil.email}</p>
      <Aviso tom="erro">{erro}</Aviso>

      {pontos?.length === 0 && (
        <Cartao>Sua conta está criada. Assim que o administrador liberar o seu ponto, as leituras aparecem aqui.</Cartao>
      )}

      {ponto && <>
        <Cartao className="space-y-3">
          {pontos.length > 1 && (
            <Selecao rotulo="Ponto" value={pontoId} onChange={(e) => setPontoId(e.target.value)}>
              {pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
          )}
          <Selecao rotulo="Mês" value={mes} onChange={(e) => setMes(e.target.value)}>
            {ultimosMeses().map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </Selecao>
        </Cartao>

        {leituras && (
          <>
            <div className="rounded-xl bg-slate-900 p-4 text-center text-white shadow">
              <div className="text-sm font-semibold tracking-wide">SUA PARTE NO MÊS ({percentual(ponto.percentual_ponto)})</div>
              <div className="py-1 text-4xl font-bold tabular-nums">{moeda(soma(leituras, 'partePonto'))}</div>
              <div className="text-sm text-slate-300">{leituras.length} leitura(s)</div>
            </div>
            <Cartao>
              <Linha rotulo="Entrada" valor={moeda(soma(leituras, 'totalEntrada'))} />
              <Linha rotulo="Saída" valor={moeda(soma(leituras, 'totalSaida'))} />
              <Linha rotulo="Resultado" valor={moeda(soma(leituras, 'resultado'))} forte />
              <Linha rotulo="Despesas" valor={moeda(soma(leituras, 'totalDespesas'))} />
            </Cartao>
            {aConferir > 0 && <Aviso>{aConferir} leitura(s) esperando a sua conferência.</Aviso>}
          </>
        )}

        <h2 className="px-1 pt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Leituras do mês</h2>
        {!leituras && !erro && <Cartao>Carregando…</Cartao>}
        {leituras?.length === 0 && <Cartao>Nenhuma leitura neste mês.</Cartao>}
        {leituras?.map((l) => (
          <Link key={l.id} to={`/leituras/${l.id}`} className="block">
            <Cartao className="active:bg-slate-50">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{dataHora(l.dataHora)}</span>
                <span className="text-lg font-bold tabular-nums">{moeda(l.partePonto)}</span>
              </div>
              <div className="text-sm text-slate-600">
                Entrada {moeda(l.totalEntrada)} · Saída {moeda(l.totalSaida)}
              </div>
              <span className={`mt-1 inline-block rounded px-2 py-1 text-xs font-semibold ${l.conferidoEm ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                {l.conferidoEm ? 'Conferido' : 'A conferir'}
              </span>
            </Cartao>
          </Link>
        ))}
      </>}
    </Tela>
  );
}
