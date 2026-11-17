// Mostra a foto do contador dentro da própria tela.
// O bucket é privado: ao tocar, o app pede um link temporário (5 minutos) ao Supabase.
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function FotoContador({ caminho }) {
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState('');
  if (!caminho) return null;

  async function abrir() {
    setErro('');
    const { data, error } = await supabase.storage.from('contadores').createSignedUrl(caminho, 300);
    if (error) setErro('Foto ainda não disponível (pode estar esperando envio).');
    else setUrl(data.signedUrl);
  }

  if (url) return <img src={url} alt="Foto do contador" className="mt-2 w-full rounded-lg border border-slate-200" />;
  return (
    <div className="pt-1">
      <button type="button" onClick={abrir} className="font-medium text-emerald-700 underline">📷 Ver foto do contador</button>
      {erro && <div className="text-sm text-red-700">{erro}</div>}
    </div>
  );
}
