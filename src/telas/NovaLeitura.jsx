// TELA PRINCIPAL: registrar leitura de um ponto.
// 1) escolhe o ponto  2) digita a leitura de cada máquina  3) despesas  4) confere o caixa  5) salva
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useSessao } from '../lib/sessao.jsx';
import { carregarDados, enfileirar, sincronizar } from '../lib/fila.js';
import { resumoLocal } from '../lib/leituras.js';
import { calcularLeitura, calcularMaquina } from '../lib/calculos.js';
import { paraNumero, paraCampo, numero, moeda, STATUS, dataSimples } from '../lib/formato.js';
import Assinatura from '../componentes/Assinatura.jsx';
import { Campo } from '../componentes/ui.jsx';
import { reduzirFoto } from '../lib/fotos.js';
import { Tela, Cartao, CampoValor, Botao, Marcador, Aviso } from '../componentes/ui.jsx';
import Despesas, { lerDespesas } from '../componentes/Despesas.jsx';
import Divisao, { Diferenca } from '../componentes/Divisao.jsx';

function EscolherPonto({ dados }) {
  return (
    <Tela titulo="Nova leitura" voltar="/">
      {dados.offline && <Aviso>Sem internet: mostrando os pontos guardados no aparelho.</Aviso>}
      {dados.pontos.length === 0 && <Cartao>Nenhum ponto disponível para você.</Cartao>}
      {dados.pontos.map((p) => {
        const qtd = dados.maquinas.filter((m) => m.ponto_id === p.id).length;
        return (
          <Link key={p.id} to={`/leitura/${p.id}`} className="block">
            <Cartao className="active:bg-slate-50">
              <div className="text-xl font-semibold">{p.nome}</div>
              <div className="text-sm text-slate-600">{p.endereco}</div>
              <div className="text-sm text-slate-500">{qtd} máquina(s)</div>
            </Cartao>
          </Link>
        );
      })}
    </Tela>
  );
}

function CartaoMaquina({ maquina, valor, onChange }) {
  const entrada = paraNumero(valor.entrada);
  const saida = paraNumero(valor.saida);
  const completo = entrada !== null && saida !== null;
  const c = completo && calcularMaquina({
    entradaAnterior: Number(maquina.entrada_atual), saidaAnterior: Number(maquina.saida_atual),
    entradaAtual: entrada, saidaAtual: saida,
  });

  async function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    if (arquivo) onChange({ ...valor, foto: await reduzirFoto(arquivo) });
  }

  return (
    <Cartao className="space-y-3">
      <div className="text-lg font-semibold">{maquina.codigo} · {maquina.nome_jogo}</div>
      {maquina.status && maquina.status !== 'funcionando' && (
        <span className={`inline-block rounded px-2 py-1 text-sm font-semibold ${STATUS[maquina.status].classe}`}>
          {STATUS[maquina.status].icone} {STATUS[maquina.status].texto}
        </span>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500">Entrada anterior</div>
          <div className="font-semibold tabular-nums">{numero(maquina.entrada_atual)}</div>
          <CampoValor rotulo="Entrada atual" value={valor.entrada} onChange={(v) => onChange({ ...valor, entrada: v })} />
        </div>
        <div>
          <div className="text-xs text-slate-500">Saída anterior</div>
          <div className="font-semibold tabular-nums">{numero(maquina.saida_atual)}</div>
          <CampoValor rotulo="Saída atual" value={valor.saida} onChange={(v) => onChange({ ...valor, saida: v })} />
        </div>
      </div>

      {c && c.menor && (
        <Aviso tom={valor.zerado ? 'alerta' : 'erro'}>
          <div className="font-semibold">Leitura atual menor que a anterior.</div>
          Confira se digitou certo. Se o contador da máquina zerou, marque abaixo:
          <Marcador rotulo="Contador zerado (usar a nova leitura como base)" checked={valor.zerado}
            onChange={(zerado) => onChange({ ...valor, zerado })} />
        </Aviso>
      )}

      {c && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 text-center text-sm">
          <div><div className="text-slate-500">Entrada</div><div className="font-semibold tabular-nums">{moeda(c.entrada)}</div></div>
          <div><div className="text-slate-500">Saída</div><div className="font-semibold tabular-nums">{moeda(c.saida)}</div></div>
          <div><div className="text-slate-500">Resultado</div><div className="font-bold tabular-nums">{moeda(c.resultado)}</div></div>
        </div>
      )}

      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-slate-300 font-medium text-slate-700">
        {valor.foto ? '📷 Foto anexada — trocar' : '📷 Foto do contador (opcional)'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={escolherFoto} />
      </label>
    </Cartao>
  );
}

function Formulario({ ponto, maquinas, custos, fixas }) {
  const { perfil } = useSessao();
  const navegar = useNavigate();
  const [valores, setValores] = useState({});          // por máquina: { entrada, saida, zerado, foto }
  // Custos de manutenção marcados como "despesa do ponto" já entram na lista (dá para remover)
  // O mesmo vale para as despesas fixas do mês (salário, aluguel...) que ainda não entraram em leitura
  const [linhasDespesa, setLinhasDespesa] = useState(() => [
    ...fixas.map((f) => ({ descricao: f.descricao, valor: paraCampo(f.valor), categoria: f.categoria, fixaId: f.id, competencia: f.competencia })),
    ...custos.map((c) => ({
      descricao: `Manutenção ${c.maquinas?.codigo ?? ''} (${dataSimples(c.data)}): ${c.problema}`,
      valor: paraCampo(c.custo), categoria: 'manutencao', manutencaoId: c.id,
    })),
  ]);
  const [assinatura, setAssinatura] = useState(null);   // imagem da assinatura do responsável
  const [assinaturaNome, setAssinaturaNome] = useState('');
  const [pontoPago, setPontoPago] = useState(false);
  const [recolhido, setRecolhido] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const valorDe = (id) => valores[id] ?? { entrada: '', saida: '', zerado: false, foto: null };

  // Máquinas com as duas leituras preenchidas entram na conta
  const lidas = useMemo(() => maquinas.flatMap((m) => {
    const v = valorDe(m.id);
    const entradaAtual = paraNumero(v.entrada), saidaAtual = paraNumero(v.saida);
    if (entradaAtual === null || saidaAtual === null) return [];
    return [{
      maquinaId: m.id, codigo: m.codigo, nomeJogo: m.nome_jogo, zerado: v.zerado, foto: v.foto,
      entradaAnterior: Number(m.entrada_atual), saidaAnterior: Number(m.saida_atual), entradaAtual, saidaAtual,
    }];
  }), [maquinas, valores]);

  const despesasPrevia = lerDespesas(linhasDespesa).despesas ?? [];
  const previa = calcularLeitura({
    maquinas: lidas, despesas: despesasPrevia, percentual: Number(ponto.percentual_ponto),
    regra: ponto.regra_despesa, pontoPago, recolhido: paraNumero(recolhido),
  });

  async function salvar() {
    setErro('');
    // --- validações ---
    const pelaMetade = maquinas.find((m) => {
      const v = valorDe(m.id);
      return (v.entrada !== '') !== (v.saida !== '') || (v.entrada !== '' && paraNumero(v.entrada) === null) || (v.saida !== '' && paraNumero(v.saida) === null);
    });
    if (pelaMetade) return setErro(`Máquina ${pelaMetade.codigo}: preencha entrada e saída com números válidos.`);
    if (lidas.length === 0) return setErro('Digite a leitura de pelo menos uma máquina.');
    const menor = lidas.find((m) => calcularMaquina(m).menor && !m.zerado);
    if (menor) return setErro(`Máquina ${menor.codigo}: leitura atual menor que a anterior. Corrija o número ou marque "Contador zerado".`);
    const { despesas, erro: erroDespesa } = lerDespesas(linhasDespesa);
    if (erroDespesa) return setErro(erroDespesa);
    if (recolhido !== '' && paraNumero(recolhido) === null) return setErro('Valor recolhido inválido.');
    const faltando = maquinas.length - lidas.length;
    if (faltando > 0 && !window.confirm(`${faltando} máquina(s) ficaram sem leitura e não entram nesta leitura. Salvar assim mesmo?`)) return;

    // --- monta e guarda no aparelho; o envio acontece em seguida (ou quando voltar o sinal) ---
    setOcupado(true);
    const id = crypto.randomUUID();
    const dataHora = new Date().toISOString();
    const caminhoFoto = (m) => (m.foto ? `${ponto.id}/${id}/${m.maquinaId}.jpg` : null);
    const assinaturaCaminho = assinatura ? `${ponto.id}/${id}/assinatura.png` : null;
    const payload = {
      id, ponto_id: ponto.id, data_hora: dataHora, ponto_pago_na_hora: pontoPago,
      valor_recolhido: paraNumero(recolhido), observacao: observacao.trim(),
      assinatura_caminho: assinaturaCaminho, assinatura_nome: assinatura ? assinaturaNome.trim() : '',
      maquinas: lidas.map((m) => ({
        maquina_id: m.maquinaId, entrada_atual: m.entradaAtual, saida_atual: m.saidaAtual,
        contador_zerado: m.zerado, foto_caminho: caminhoFoto(m),
      })),
      despesas,
    };
    const resumo = resumoLocal({
      id, ponto, operadorNome: perfil.nome, dataHora, despesas, pontoPago,
      recolhido: paraNumero(recolhido), observacao: observacao.trim(),
      assinaturaCaminho, assinaturaNome: assinatura ? assinaturaNome.trim() : '',
      maquinas: lidas.map(({ foto, ...m }) => ({ ...m, fotoCaminho: caminhoFoto({ ...m, foto }) })),
    });
    const fotos = lidas.filter((m) => m.foto).map((m) => ({ caminho: caminhoFoto(m), blob: m.foto }));
    if (assinatura) fotos.push({ caminho: assinaturaCaminho, blob: assinatura });
    try {
      await enfileirar({ id, payload, fotos, resumo });
      await Promise.race([sincronizar(), new Promise((ok) => setTimeout(ok, 8000))]); // não trava a tela com sinal ruim
      navegar(`/leituras/${id}`, { replace: true });
    } catch (e) {
      setOcupado(false);
      setErro(`Não foi possível guardar a leitura no aparelho: ${e.message}`);
    }
  }

  return (
    <Tela titulo={ponto.nome} voltar="/leitura">
      {maquinas.length === 0 && <Cartao>Este ponto não tem máquinas ativas.</Cartao>}
      {maquinas.map((m) => (
        <CartaoMaquina key={m.id} maquina={m} valor={valorDe(m.id)}
          onChange={(v) => setValores({ ...valores, [m.id]: v })} />
      ))}

      <Despesas linhas={linhasDespesa} onChange={setLinhasDespesa} />
      <Divisao c={previa} percentual={ponto.percentual_ponto} regra={ponto.regra_despesa} pontoPago={pontoPago} />

      <Cartao className="space-y-3">
        <Marcador rotulo="Já paguei a parte do ponto agora" checked={pontoPago} onChange={setPontoPago} />
        <CampoValor rotulo="Valor recolhido (R$)" value={recolhido} onChange={setRecolhido} />
        <Diferenca valor={previa.diferenca} />
        <label className="block text-sm font-medium text-slate-600">
          Observação
          <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Assinatura do responsável do ponto (opcional)</h2>
        <Assinatura onChange={setAssinatura} />
        {assinatura && <Campo rotulo="Nome de quem assinou" value={assinaturaNome} onChange={(e) => setAssinaturaNome(e.target.value)} />}
      </Cartao>

      <Aviso tom="erro">{erro}</Aviso>
      <Botao onClick={salvar} disabled={ocupado} className="min-h-16 text-xl">{ocupado ? 'Salvando…' : 'Salvar leitura'}</Botao>
    </Tela>
  );
}

export default function NovaLeitura() {
  const { pontoId } = useParams();
  const [dados, setDados] = useState(null);
  useEffect(() => { carregarDados().then(setDados); }, []);

  if (!dados) return <Tela titulo="Nova leitura" voltar="/"><Cartao>Carregando…</Cartao></Tela>;
  if (!pontoId) return <EscolherPonto dados={dados} />;
  const ponto = dados.pontos.find((p) => p.id === pontoId);
  if (!ponto) return <Tela titulo="Nova leitura" voltar="/leitura"><Cartao>Ponto não encontrado.</Cartao></Tela>;
  return (
    <Formulario key={pontoId} ponto={ponto} maquinas={dados.maquinas.filter((m) => m.ponto_id === pontoId)}
      custos={(dados.custosManutencao ?? []).filter((c) => c.ponto_id === pontoId)}
      fixas={(dados.despesasFixas ?? []).filter((f) => f.ponto_id === pontoId)} />
  );
}
