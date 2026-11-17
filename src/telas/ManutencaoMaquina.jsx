// MANUTENÇÃO de uma máquina: status atual, nova ocorrência e histórico.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { moeda, paraNumero, STATUS, dataSimples } from '../lib/formato.js';
import { reduzirFoto, enviarFoto } from '../lib/fotos.js';
import { hojeSP } from '../lib/painel.js';
import { Tela, Cartao, Campo, CampoValor, Selecao, Botao, Aviso, Linha } from '../componentes/ui.jsx';
import FotoContador from '../componentes/FotoContador.jsx';

// Fotos de máquina em estoque (sem ponto) ficam nesta pasta, que só o Admin acessa
const PASTA_ESTOQUE = '00000000-0000-0000-0000-000000000000';
const DESTINOS = {
  so_da_empresa: 'Só da empresa (não entra na leitura)',
  despesa_do_ponto: 'Despesa do ponto (entra na próxima leitura)',
};
const novo = () => ({ data: hojeSP(), problema: '', peca: '', custo: '', quem: '', destino: 'so_da_empresa', foto: null });

export default function ManutencaoMaquina() {
  const { id } = useParams();
  const [maq, setMaq] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [status, setStatus] = useState('funcionando');
  const [f, setF] = useState(novo());
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e?.target ? e.target.value : e });

  async function carregar() {
    const m = await supabase.from('maquinas').select('*, pontos(nome)').eq('id', id).single();
    if (m.error) return setMsg({ tom: 'erro', texto: m.error.message });
    setMaq(m.data); setStatus(m.data.status);
    const h = await supabase.from('manutencoes').select('*').eq('maquina_id', id).order('data', { ascending: false }).order('criado_em', { ascending: false });
    setHistorico(h.data ?? []);
  }
  useEffect(() => { carregar(); }, [id]);

  async function salvar() {
    setMsg(null);
    const custo = f.custo === '' ? 0 : paraNumero(f.custo);
    if (!f.problema.trim()) return setMsg({ tom: 'erro', texto: 'Descreva o problema ou o serviço feito.' });
    if (custo === null) return setMsg({ tom: 'erro', texto: 'Custo inválido.' });
    setOcupado(true);
    try {
      const foto = f.foto ? await enviarFoto(`${maq.ponto_id ?? PASTA_ESTOQUE}/manutencao/${crypto.randomUUID()}.jpg`, f.foto) : null;
      const { error } = await supabase.rpc('registrar_manutencao', { p: {
        maquina_id: id, status, data: f.data, problema: f.problema, peca_trocada: f.peca, custo, quem_fez: f.quem, foto_caminho: foto, destino: f.destino,
      } });
      if (error) throw error;
      setF(novo()); setMsg({ tom: 'ok', texto: 'Ocorrência registrada.' });
      await carregar();
    } catch (e) { setMsg({ tom: 'erro', texto: e.message }); }
    setOcupado(false);
  }

  if (!maq) return <Tela titulo="Manutenção" voltar="/manutencao"><Aviso tom={msg?.tom}>{msg?.texto}</Aviso></Tela>;
  const totalCustos = historico.reduce((s, h) => s + Number(h.custo), 0);

  return (
    <Tela titulo={`${maq.codigo} · ${maq.nome_jogo}`} voltar="/manutencao">
      <Cartao>
        <Linha rotulo="Ponto" valor={maq.pontos?.nome ?? 'Em estoque'} />
        <Linha rotulo="Status atual" valor={`${STATUS[maq.status].icone} ${STATUS[maq.status].texto}`} forte />
        <Linha rotulo="Total gasto em manutenção" valor={moeda(totalCustos)} />
      </Cartao>

      <Cartao className="space-y-3">
        <h2 className="font-semibold">Nova ocorrência</h2>
        <div>
          <div className="text-sm font-medium text-slate-600">Como a máquina fica depois disso</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {Object.entries(STATUS).map(([v, s]) => (
              <button key={v} type="button" onClick={() => setStatus(v)}
                className={`min-h-12 rounded-lg text-sm font-semibold ${status === v ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white'}`}>
                {s.icone} {s.texto}
              </button>
            ))}
          </div>
        </div>
        <Campo rotulo="Data" type="date" max={hojeSP()} value={f.data} onChange={mudar('data')} />
        <label className="block text-sm font-medium text-slate-600">
          Problema / serviço feito
          <textarea rows={2} value={f.problema} onChange={mudar('problema')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <Campo rotulo="Peça trocada" value={f.peca} onChange={mudar('peca')} />
        <div className="grid grid-cols-2 gap-3">
          <CampoValor rotulo="Custo (R$)" value={f.custo} onChange={mudar('custo')} />
          <Campo rotulo="Quem fez" value={f.quem} onChange={mudar('quem')} />
        </div>
        {maq.ponto_id && (
          <Selecao rotulo="Quem paga o custo" value={f.destino} onChange={mudar('destino')}>
            {Object.entries(DESTINOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Selecao>
        )}
        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-slate-300 font-medium text-slate-700">
          {f.foto ? '📷 Foto anexada — trocar' : '📷 Foto (opcional)'}
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => e.target.files?.[0] && mudar('foto')(await reduzirFoto(e.target.files[0]))} />
        </label>
        <Aviso tom={msg?.tom}>{msg?.texto}</Aviso>
        <Botao onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Registrar ocorrência'}</Botao>
      </Cartao>

      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Histórico</h2>
      {historico.length === 0 && <Cartao>Nenhuma ocorrência registrada.</Cartao>}
      {historico.map((h) => (
        <Cartao key={h.id}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{dataSimples(h.data)}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS[h.status_depois].classe}`}>{STATUS[h.status_depois].icone} {STATUS[h.status_depois].texto}</span>
          </div>
          <p className="py-1">{h.problema}</p>
          {h.peca_trocada && <Linha rotulo="Peça trocada" valor={h.peca_trocada} />}
          {h.quem_fez && <Linha rotulo="Quem fez" valor={h.quem_fez} />}
          {Number(h.custo) > 0 && <>
            <Linha rotulo="Custo" valor={moeda(h.custo)} forte />
            <div className="text-sm text-slate-500">
              {h.destino === 'so_da_empresa' ? 'Pago só pela empresa'
                : h.leitura_id ? 'Despesa do ponto — já descontada em uma leitura' : 'Despesa do ponto — entra na próxima leitura'}
            </div>
          </>}
          <FotoContador caminho={h.foto_caminho} rotulo="Ver foto" />
        </Cartao>
      ))}
    </Tela>
  );
}
