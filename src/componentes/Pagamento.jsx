// Pagamento da parte do ponto em uma leitura: situação, registro (data, forma, comprovante)
// e, para o Admin, desfazer. O dono do ponto só visualiza.
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { moeda, FORMAS, dataSimples } from '../lib/formato.js';
import { reduzirFoto, enviarFoto } from '../lib/fotos.js';
import { hojeSP } from '../lib/painel.js';
import { Cartao, Campo, Selecao, Botao, Aviso, Linha } from './ui.jsx';
import FotoContador from './FotoContador.jsx';

export default function Pagamento({ l, papel, aoMudar }) {
  const [data, setData] = useState(hojeSP());
  const [forma, setForma] = useState('pix');
  const [foto, setFoto] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!(l.partePonto > 0)) return null;          // nada a pagar nesta leitura
  const podeRegistrar = papel !== 'dono' && !l.pendente;

  async function registrar() {
    setOcupado(true); setErro('');
    try {
      // O comprovante vai primeiro; o nome leva a hora para nunca sobrescrever outro arquivo
      const caminho = foto ? await enviarFoto(`${l.pontoId}/${l.id}/comprovante-${Date.now()}.jpg`, foto) : null;
      const { error } = await supabase.rpc('registrar_pagamento', { p_leitura: l.id, p_data: data, p_forma: forma, p_comprovante: caminho });
      if (error) throw error;
      aoMudar?.();
    } catch (e) { setErro(e.message); }
    setOcupado(false);
  }

  async function desfazer() {
    if (!window.confirm('Desfazer o registro deste pagamento?')) return;
    const { error } = await supabase.rpc('desfazer_pagamento', { p_leitura: l.id });
    if (error) setErro(error.message); else aoMudar?.();
  }

  return (
    <Cartao className="space-y-3">
      <h2 className="font-semibold">Pagamento ao ponto</h2>
      <Linha rotulo="Parte do ponto" valor={moeda(l.partePonto)} forte />

      {l.pagoEm ? (
        <>
          <Aviso tom="ok"><span className="font-semibold">✓ Pago em {dataSimples(l.pagoEm)} — {FORMAS[l.pagoForma] ?? '—'}</span></Aviso>
          <FotoContador caminho={l.pagoComprovante} rotulo="Ver comprovante" />
          {papel === 'admin' && !l.pontoPago && (
            <button onClick={desfazer} className="text-sm text-red-700 underline">Desfazer pagamento</button>
          )}
        </>
      ) : (
        <>
          <Aviso><span className="font-semibold">Pendente: a parte do ponto ainda não foi paga.</span></Aviso>
          {podeRegistrar && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Data do pagamento" type="date" value={data} max={hojeSP()} onChange={(e) => setData(e.target.value)} />
                <Selecao rotulo="Forma" value={forma} onChange={(e) => setForma(e.target.value)}>
                  {Object.entries(FORMAS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </Selecao>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-slate-300 font-medium text-slate-700">
                {foto ? '📷 Comprovante anexado — trocar' : '📷 Foto do comprovante (opcional)'}
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => e.target.files?.[0] && setFoto(await reduzirFoto(e.target.files[0]))} />
              </label>
              <Botao onClick={registrar} disabled={ocupado || !data}>{ocupado ? 'Registrando…' : 'Registrar pagamento'}</Botao>
            </>
          )}
          {l.pendente && <p className="text-sm text-slate-500">O pagamento pode ser registrado depois que a leitura for enviada.</p>}
        </>
      )}
      <Aviso tom="erro">{erro}</Aviso>
    </Cartao>
  );
}
