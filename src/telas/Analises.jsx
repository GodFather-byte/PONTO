// ANÁLISES (Admin) — Versão 2:
//  • Comparativo: mês escolhido x mês anterior, por ponto e por máquina, com % de variação
//  • Máquinas: média de resultado por leitura e por mês, com alerta de rendimento baixo ou negativo
//  • Operadores: leituras, pontos visitados e diferenças de caixa
import { useEffect, useState } from 'react';
import { moeda } from '../lib/formato.js';
import { ultimosMeses, mesAtual } from '../lib/leituras.js';
import { buscarPeriodo, hojeSP, somaDias } from '../lib/painel.js';
import { comparativo, mediasPorMaquina, desempenhoOperadores, mesAnterior, fimDoMes } from '../lib/analises.js';
import { Tela, Cartao, Selecao, Aviso, Linha } from '../componentes/ui.jsx';
import BarrasComparativas, { Legenda, TextoVariacao } from '../componentes/BarrasComparativas.jsx';

// Grupo de botões para alternar (abas, filtros)
function Alternar({ opcoes, valor, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map(([v, texto]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`min-h-11 rounded-lg text-sm font-semibold ${valor === v ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}>
          {texto}
        </button>
      ))}
    </div>
  );
}

// Busca leituras de um intervalo e devolve [dados, erro]
function useLeituras(inicio, fim) {
  const [estado, setEstado] = useState({ dados: null, erro: '' });
  useEffect(() => {
    setEstado({ dados: null, erro: '' });
    buscarPeriodo(inicio, fim).then((dados) => setEstado({ dados, erro: '' })).catch((e) => setEstado({ dados: null, erro: e.message }));
  }, [inicio, fim]);
  return estado;
}

const nomeMes = (mes) => ultimosMeses(24).find((m) => m.valor === mes)?.texto ?? mes;

function SeletorMes({ mes, onChange }) {
  return (
    <Selecao rotulo="Mês" value={mes} onChange={(e) => onChange(e.target.value)}>
      {ultimosMeses().map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
    </Selecao>
  );
}

function Comparativo() {
  const [mes, setMes] = useState(mesAtual());
  const [por, setPor] = useState('pontos');
  const [tabela, setTabela] = useState(false);
  const antes = mesAnterior(mes);
  const { dados, erro } = useLeituras(`${antes}-01`, fimDoMes(mes));
  const c = dados && comparativo(dados, mes);
  const itens = c?.[por] ?? [];

  return (
    <>
      <Cartao className="space-y-3">
        <SeletorMes mes={mes} onChange={setMes} />
        {mes === mesAtual() && <p className="text-sm text-slate-500">Mês em andamento: a comparação é com o mês anterior inteiro.</p>}
      </Cartao>
      <Aviso tom="erro">{erro}</Aviso>
      {!dados && !erro && <Cartao>Carregando…</Cartao>}
      {c && <>
        <Cartao>
          <div className="text-sm text-slate-600">Resultado de {nomeMes(mes)}</div>
          <div className="text-3xl font-bold tabular-nums">{moeda(c.total.atual)}</div>
          <div className="text-sm text-slate-600">
            <TextoVariacao v={c.total.variacao} temAnterior={c.total.anterior !== 0} /> sobre {nomeMes(antes)} ({moeda(c.total.anterior)})
          </div>
        </Cartao>

        <Alternar opcoes={[['pontos', 'Por ponto'], ['maquinas', 'Por máquina']]} valor={por} onChange={setPor} />
        <Cartao className="space-y-4">
          <Legenda atual={nomeMes(mes)} anterior={nomeMes(antes)} />
          {itens.length === 0 && <div className="text-slate-500">Sem leituras nesses dois meses.</div>}
          {!tabela ? (
            <BarrasComparativas itens={itens} rotuloAtual={nomeMes(mes)} rotuloAnterior={nomeMes(antes)} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1 font-medium">{por === 'pontos' ? 'Ponto' : 'Máquina'}</th>
                <th className="text-right font-medium">Atual</th><th className="text-right font-medium">Anterior</th><th className="text-right font-medium">Variação</th></tr></thead>
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-2">{i.nome}</td>
                    <td className="text-right tabular-nums">{moeda(i.atual)}</td>
                    <td className="text-right tabular-nums">{moeda(i.anterior)}</td>
                    <td className="text-right"><TextoVariacao v={i.variacao} temAnterior={i.anterior !== 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {itens.length > 0 && (
            <button onClick={() => setTabela(!tabela)} className="text-sm font-medium text-emerald-700 underline">
              {tabela ? 'Ver em gráfico' : 'Ver em tabela'}
            </button>
          )}
        </Cartao>
      </>}
    </>
  );
}

const ALERTAS = {
  negativo: 'Resultado negativo — considerar trocar de ponto',
  baixo: 'Rendimento baixo — considerar trocar de ponto',
};

function Maquinas() {
  const [dias, setDias] = useState('90');
  const hoje = hojeSP();
  const { dados, erro } = useLeituras(somaDias(hoje, -Number(dias)), hoje);
  const r = dados && mediasPorMaquina(dados, Number(dias) / 30);
  const comAlerta = r?.maquinas.filter((m) => m.alerta).length ?? 0;

  return (
    <>
      <Alternar opcoes={[['30', '30 dias'], ['90', '90 dias'], ['180', '180 dias']]} valor={dias} onChange={setDias} />
      <Aviso tom="erro">{erro}</Aviso>
      {!dados && !erro && <Cartao>Carregando…</Cartao>}
      {r && <>
        <Cartao>
          <Linha rotulo="Média geral por leitura" valor={moeda(r.mediaGeral)} forte />
          <Linha rotulo="Máquinas com leitura no período" valor={r.maquinas.length} />
          <Linha rotulo="Máquinas com alerta" valor={comAlerta} />
          <p className="pt-1 text-xs text-slate-500">Alerta de rendimento baixo: média por leitura abaixo de metade da média geral.</p>
        </Cartao>
        {r.maquinas.length === 0 && <Cartao>Sem leituras no período.</Cartao>}
        {r.maquinas.map((m) => (
          <Cartao key={m.id}>
            <div className="font-semibold">{m.nome}</div>
            <div className="text-sm text-slate-500">{m.ponto} · {m.leituras} leitura(s)</div>
            {m.alerta && (
              <div className={`my-2 rounded-lg border px-3 py-2 text-sm font-semibold ${m.alerta === 'negativo' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                ⚠ {ALERTAS[m.alerta]}
              </div>
            )}
            <Linha rotulo="Média por leitura" valor={moeda(m.mediaLeitura)} forte />
            <Linha rotulo="Média por mês" valor={moeda(m.mediaMes)} />
            <Linha rotulo="Total no período" valor={moeda(m.total)} />
          </Cartao>
        ))}
      </>}
    </>
  );
}

function Operadores() {
  const [mes, setMes] = useState(mesAtual());
  const { dados, erro } = useLeituras(`${mes}-01`, fimDoMes(mes));
  const lista = dados && desempenhoOperadores(dados);

  return (
    <>
      <Cartao><SeletorMes mes={mes} onChange={setMes} /></Cartao>
      <Aviso tom="erro">{erro}</Aviso>
      {!dados && !erro && <Cartao>Carregando…</Cartao>}
      {lista?.length === 0 && <Cartao>Sem leituras neste mês.</Cartao>}
      {lista?.map((o) => (
        <Cartao key={o.nome}>
          <div className="mb-1 text-lg font-semibold">{o.nome}</div>
          <Linha rotulo="Leituras" valor={o.leituras} />
          <Linha rotulo="Pontos visitados" valor={o.pontos} />
          <Linha rotulo="Resultado das leituras" valor={moeda(o.resultado)} />
          <div className="my-2 border-t border-slate-200" />
          <Linha rotulo="Esperado em caixa" valor={moeda(o.esperado)} />
          <Linha rotulo="Recolhido" valor={moeda(o.recolhido)} />
          <Linha rotulo="Leituras com diferença" valor={o.comDiferenca} />
          <Linha rotulo="Faltou" valor={moeda(o.faltando)} />
          <Linha rotulo="Sobrou" valor={moeda(o.sobrando)} />
          <div className={`mt-1 rounded-lg px-3 py-2 text-center font-bold ${o.saldo === 0 ? 'bg-emerald-50 text-emerald-900' : o.saldo < 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
            {o.saldo === 0 ? 'Caixa confere no mês' : o.saldo < 0 ? `Saldo: faltando ${moeda(-o.saldo)}` : `Saldo: sobrando ${moeda(o.saldo)}`}
          </div>
          {o.semRecolhido > 0 && <p className="pt-2 text-sm text-slate-600">{o.semRecolhido} leitura(s) sem valor recolhido informado.</p>}
        </Cartao>
      ))}
    </>
  );
}

export default function Analises() {
  const [aba, setAba] = useState('comparativo');
  return (
    <Tela titulo="Análises" voltar="/">
      <Alternar opcoes={[['comparativo', 'Comparativo'], ['maquinas', 'Máquinas'], ['operadores', 'Operadores']]} valor={aba} onChange={setAba} />
      {aba === 'comparativo' && <Comparativo />}
      {aba === 'maquinas' && <Maquinas />}
      {aba === 'operadores' && <Operadores />}
    </Tela>
  );
}
