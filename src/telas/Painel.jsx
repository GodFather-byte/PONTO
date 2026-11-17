// PAINEL DO ADMIN: totais do dia/semana/mês, pontos sem leitura, controle de caixa,
// rankings e exportação do período (PDF e CSV).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { moeda, nomeCategoria } from '../lib/formato.js';
import {
  hojeSP, somaDias, inicioSemana, inicioMes, dataBR, totalizar, ranking, controleCaixa, buscarPeriodo, pontosSemLeitura,
} from '../lib/painel.js';
import { csvLeituras, csvMaquinas, csvDespesas, baixar, gerarPdfPeriodo } from '../lib/exportar.js';
import { Tela, Cartao, Campo, Botao, Aviso, Linha } from '../componentes/ui.jsx';

function CartaoTotal({ titulo, t }) {
  return (
    <Cartao className="!px-1 !py-3 text-center">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className="text-[15px] font-bold tabular-nums">{moeda(t.resultado)}</div>
      <div className="text-xs text-slate-600 tabular-nums">Empresa {moeda(t.parteEmpresa)}</div>
      <div className="text-xs text-slate-500">{t.qtd} leitura(s)</div>
    </Cartao>
  );
}

function Ranking({ titulo, itens, detalhe }) {
  const [tudo, setTudo] = useState(false);
  const visiveis = tudo ? itens : itens.slice(0, 5);
  return (
    <Cartao>
      <h2 className="mb-1 font-semibold">{titulo}</h2>
      {itens.length === 0 && <div className="text-slate-500">Sem leituras no período.</div>}
      {visiveis.map((i, n) => (
        <div key={n} className="flex items-baseline gap-2 border-t border-slate-100 py-2">
          <span className="w-6 text-sm font-bold text-slate-400">{n + 1}º</span>
          <span className="flex-1">{i.nome}<span className="block text-xs text-slate-500">{detalhe(i)}</span></span>
          <span className={`font-semibold tabular-nums ${i.resultado < 0 ? 'text-red-700' : ''}`}>{moeda(i.resultado)}</span>
        </div>
      ))}
      {itens.length > 5 && (
        <button onClick={() => setTudo(!tudo)} className="pt-2 text-sm font-medium text-emerald-700 underline">
          {tudo ? 'Mostrar só os 5 primeiros' : `Ver todos (${itens.length})`}
        </button>
      )}
    </Cartao>
  );
}

export default function Painel() {
  const hoje = hojeSP();
  const [resumo, setResumo] = useState(null);       // leituras desde o início do mês/semana (cartões do topo)
  const [dias, setDias] = useState('');             // X dias sem leitura (configurável)
  const [parados, setParados] = useState(null);
  const [inicio, setInicio] = useState(inicioMes(hoje));
  const [fim, setFim] = useState(hoje);
  const [leituras, setLeituras] = useState(null);   // leituras do período escolhido
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);

  // Cartões do topo + configuração
  useEffect(() => {
    const desde = [inicioMes(hoje), inicioSemana(hoje)].sort()[0];
    buscarPeriodo(desde, hoje).then(setResumo).catch((e) => setErro(e.message));
    supabase.from('configuracoes').select('dias_sem_leitura').single().then(({ data }) => {
      const x = data?.dias_sem_leitura ?? 7;
      setDias(String(x));
      pontosSemLeitura(x).then(setParados).catch((e) => setErro(e.message));
    });
  }, []);

  // Período escolhido
  useEffect(() => {
    if (!inicio || !fim || inicio > fim) return;
    setLeituras(null);
    buscarPeriodo(inicio, fim).then(setLeituras).catch((e) => setErro(e.message));
  }, [inicio, fim]);

  async function salvarDias() {
    const x = parseInt(dias, 10);
    if (!(x > 0)) return setErro('Informe um número de dias maior que zero.');
    setErro('');
    const { error } = await supabase.from('configuracoes').update({ dias_sem_leitura: x }).eq('id', true);
    if (error) return setErro(error.message);
    setParados(null);
    pontosSemLeitura(x).then(setParados);
  }

  const atalhos = [
    ['Hoje', hoje, hoje], ['Semana', inicioSemana(hoje), hoje], ['Mês', inicioMes(hoje), hoje],
    ['Mês passado', inicioMes(somaDias(inicioMes(hoje), -1)), somaDias(inicioMes(hoje), -1)],
  ];
  const nomeBase = `leituras-${inicio}-a-${fim}`;
  const t = leituras && totalizar(leituras);
  const c = leituras && controleCaixa(leituras);
  const rk = leituras && ranking(leituras);

  async function pdf() {
    setGerando(true);
    try { (await gerarPdfPeriodo({ inicio, fim, leituras })).save(`${nomeBase}.pdf`); }
    catch (e) { setErro(`Não foi possível gerar o PDF: ${e.message}`); }
    setGerando(false);
  }

  return (
    <Tela titulo="Painel" voltar="/">
      <Aviso tom="erro">{erro}</Aviso>

      {resumo ? (
        <div className="grid grid-cols-3 gap-2">
          <CartaoTotal titulo="Hoje" t={totalizar(resumo.filter((l) => l.dataLocal === hoje))} />
          <CartaoTotal titulo="Semana" t={totalizar(resumo.filter((l) => l.dataLocal >= inicioSemana(hoje)))} />
          <CartaoTotal titulo="Mês" t={totalizar(resumo.filter((l) => l.dataLocal >= inicioMes(hoje)))} />
        </div>
      ) : <Cartao>Carregando…</Cartao>}

      <Cartao className="space-y-2">
        <h2 className="font-semibold">Pontos sem leitura</h2>
        <div className="flex items-end gap-2">
          <Campo rotulo="Avisar depois de quantos dias" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} className="flex-1" />
          <button onClick={salvarDias} className="min-h-12 rounded-lg bg-slate-900 px-4 font-semibold text-white">Salvar</button>
        </div>
        {parados?.length === 0 && <Aviso tom="ok">Todos os pontos ativos estão em dia.</Aviso>}
        {parados?.map((p) => (
          <div key={p.id} className="flex items-baseline justify-between border-t border-slate-100 py-2">
            <span>{p.nome}</span>
            <span className="text-sm font-semibold text-red-700">
              {p.dias === null ? 'Nunca teve leitura' : `${p.dias} dias (última em ${dataBR(p.ultima)})`}
            </span>
          </div>
        ))}
      </Cartao>

      <h2 className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Período</h2>
      <Cartao className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {atalhos.map(([nome, de, ate]) => (
            <button key={nome} onClick={() => { setInicio(de); setFim(ate); }}
              className={`min-h-11 rounded-lg text-sm font-semibold ${inicio === de && fim === ate ? 'bg-slate-900 text-white' : 'border border-slate-300'}`}>
              {nome}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="De" type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} />
          <Campo rotulo="Até" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
        </div>
      </Cartao>

      {!leituras && !erro && <Cartao>Carregando…</Cartao>}
      {leituras && <>
        <Cartao>
          <h2 className="mb-1 font-semibold">Totais — {dataBR(inicio)} a {dataBR(fim)}</h2>
          <Linha rotulo="Leituras" valor={t.qtd} />
          <Linha rotulo="Entrada" valor={moeda(t.entrada)} />
          <Linha rotulo="Saída" valor={moeda(t.saida)} />
          <Linha rotulo="Resultado bruto" valor={moeda(t.resultado)} forte />
          <Linha rotulo="Despesas" valor={moeda(t.despesas)} />
          <Linha rotulo="Parte dos pontos" valor={moeda(t.partePonto)} />
          <Linha rotulo="Parte da empresa" valor={moeda(t.parteEmpresa)} forte />
        </Cartao>

        <Cartao>
          <h2 className="mb-1 font-semibold">Controle de caixa</h2>
          <Linha rotulo="Esperado em caixa" valor={moeda(c.esperado)} />
          <Linha rotulo="Recolhido" valor={moeda(c.recolhido)} />
          <div className={`my-1 rounded-lg px-3 py-2 text-center font-bold ${c.diferenca === 0 ? 'bg-emerald-50 text-emerald-900' : c.diferenca < 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
            {c.diferenca === 0 ? 'Caixa confere' : c.diferenca < 0 ? `Faltando ${moeda(-c.diferenca)}` : `Sobrando ${moeda(c.diferenca)}`}
            {c.comDiferenca > 0 && <span className="block text-xs font-medium">{c.comDiferenca} leitura(s) com diferença</span>}
          </div>
          {c.semRecolhido > 0 && (
            <Linha rotulo={`Sem valor recolhido informado (${c.semRecolhido})`} valor={moeda(c.valorSemRecolhido)} />
          )}
          <div className="my-2 border-t border-slate-200" />
          <Linha rotulo="Sangrias" valor={moeda(c.sangrias)} forte />
          {Object.entries(c.porCategoria).filter(([k]) => k !== 'sangria').map(([k, v]) => (
            <Linha key={k} rotulo={`Despesas — ${nomeCategoria(k)}`} valor={moeda(v)} />
          ))}
        </Cartao>

        <Ranking titulo="Ranking de pontos" itens={rk.pontos} detalhe={(p) => `${p.qtd} leitura(s)`} />
        <Ranking titulo="Ranking de máquinas" itens={rk.maquinas} detalhe={(m) => m.ponto} />

        <Cartao className="space-y-3">
          <h2 className="font-semibold">Exportar período</h2>
          <Botao cor="escuro" onClick={pdf} disabled={gerando || t.qtd === 0}>{gerando ? 'Gerando PDF…' : 'PDF do período'}</Botao>
          <Botao cor="claro" disabled={t.qtd === 0} onClick={() => baixar(`${nomeBase}.csv`, csvLeituras(leituras))}>Planilha — leituras (CSV)</Botao>
          <Botao cor="claro" disabled={t.qtd === 0} onClick={() => baixar(`maquinas-${inicio}-a-${fim}.csv`, csvMaquinas(leituras))}>Planilha — por máquina (CSV)</Botao>
          <Botao cor="claro" disabled={t.qtd === 0} onClick={() => baixar(`despesas-${inicio}-a-${fim}.csv`, csvDespesas(leituras))}>Planilha — despesas (CSV)</Botao>
        </Cartao>
      </>}
    </Tela>
  );
}
