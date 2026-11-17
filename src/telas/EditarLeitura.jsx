// Edição de leitura já salva (somente Admin). O servidor refaz as contas e
// guarda o antes e o depois no histórico, junto com o motivo.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { buscarLeitura } from '../lib/leituras.js';
import { calcularLeitura, calcularMaquina } from '../lib/calculos.js';
import { paraNumero, paraCampo, numero } from '../lib/formato.js';
import { Tela, Cartao, Campo, CampoValor, Botao, Marcador, Aviso } from '../componentes/ui.jsx';
import Despesas, { lerDespesas } from '../componentes/Despesas.jsx';
import Divisao, { Diferenca } from '../componentes/Divisao.jsx';

export default function EditarLeitura() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [l, setL] = useState(null);
  const [maquinas, setMaquinas] = useState([]);   // [{ ...máquina, entrada, saida, zerado }]
  const [linhasDespesa, setLinhasDespesa] = useState([]);
  const [pontoPago, setPontoPago] = useState(false);
  const [recolhido, setRecolhido] = useState('');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    buscarLeitura(id).then((r) => {
      if (!r || r.pendente) return setErro('Leitura não encontrada no servidor.');
      setL(r);
      setMaquinas(r.maquinas.map((m) => ({ ...m, entrada: paraCampo(m.entradaAtual), saida: paraCampo(m.saidaAtual) })));
      setLinhasDespesa(r.despesas.map((d) => ({ ...d, valor: paraCampo(d.valor) })));
      setPontoPago(r.pontoPago); setRecolhido(paraCampo(r.recolhido)); setObservacao(r.observacao);
    });
  }, [id]);

  if (!l) return <Tela titulo="Editar leitura" voltar><Aviso tom="erro">{erro}</Aviso></Tela>;

  const mudar = (i, campos) => setMaquinas(maquinas.map((m, j) => (j === i ? { ...m, ...campos } : m)));
  const lidas = maquinas.map((m) => ({ ...m, entradaAtual: paraNumero(m.entrada) ?? 0, saidaAtual: paraNumero(m.saida) ?? 0 }));
  const previa = calcularLeitura({
    maquinas: lidas, despesas: lerDespesas(linhasDespesa).despesas ?? [],
    percentual: l.percentual, regra: l.regra, pontoPago, recolhido: paraNumero(recolhido),
  });

  async function salvar() {
    setErro('');
    const invalida = maquinas.find((m) => paraNumero(m.entrada) === null || paraNumero(m.saida) === null);
    if (invalida) return setErro(`Máquina ${invalida.codigo}: preencha entrada e saída.`);
    const menor = lidas.find((m) => calcularMaquina(m).menor && !m.zerado);
    if (menor) return setErro(`Máquina ${menor.codigo}: leitura menor que a anterior. Corrija ou marque "Contador zerado".`);
    const { despesas, erro: erroDespesa } = lerDespesas(linhasDespesa);
    if (erroDespesa) return setErro(erroDespesa);
    if (!motivo.trim()) return setErro('Informe o motivo da alteração.');

    setOcupado(true);
    const { error } = await supabase.rpc('editar_leitura', {
      p_id: id, p_motivo: motivo,
      p: {
        ponto_pago_na_hora: pontoPago, valor_recolhido: paraNumero(recolhido), observacao: observacao.trim(), despesas,
        maquinas: lidas.map((m) => ({
          maquina_id: m.maquinaId, entrada_atual: m.entradaAtual, saida_atual: m.saidaAtual, contador_zerado: m.zerado,
        })),
      },
    });
    setOcupado(false);
    if (error) setErro(error.message); else navegar(`/leituras/${id}`, { replace: true });
  }

  return (
    <Tela titulo={`Editar — ${l.pontoNome}`} voltar>
      <Aviso>
        Se já existe uma leitura mais nova desta máquina, a "leitura anterior" dela não muda sozinha — confira a seguinte também.
      </Aviso>
      {maquinas.map((m, i) => (
        <Cartao key={m.maquinaId} className="space-y-2">
          <div className="font-semibold">{m.codigo} · {m.nomeJogo}</div>
          <div className="text-sm text-slate-500">Anterior: entrada {numero(m.entradaAnterior)} · saída {numero(m.saidaAnterior)}</div>
          <div className="grid grid-cols-2 gap-3">
            <CampoValor rotulo="Entrada atual" value={m.entrada} onChange={(v) => mudar(i, { entrada: v })} />
            <CampoValor rotulo="Saída atual" value={m.saida} onChange={(v) => mudar(i, { saida: v })} />
          </div>
          <Marcador rotulo="Contador zerado" checked={m.zerado} onChange={(zerado) => mudar(i, { zerado })} />
        </Cartao>
      ))}

      <Despesas linhas={linhasDespesa} onChange={setLinhasDespesa} />
      <Divisao c={previa} percentual={l.percentual} regra={l.regra} pontoPago={pontoPago} />

      <Cartao className="space-y-3">
        <Marcador rotulo="Parte do ponto paga na hora" checked={pontoPago} onChange={setPontoPago} />
        <CampoValor rotulo="Valor recolhido (R$)" value={recolhido} onChange={setRecolhido} />
        <Diferenca valor={previa.diferenca} />
        <Campo rotulo="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <Campo rotulo="Motivo da alteração (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Cartao>

      <Aviso tom="erro">{erro}</Aviso>
      <Botao onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar alteração'}</Botao>
    </Tela>
  );
}
