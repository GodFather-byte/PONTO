// BACKUP (Admin): baixa todos os dados em um arquivo e lista as cópias guardadas
// (uma automática por semana e as feitas na hora). As fotos não entram no arquivo.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { dataHora } from '../lib/formato.js';
import { baixar } from '../lib/exportar.js';
import { Tela, Cartao, Botao, Aviso } from '../componentes/ui.jsx';

const tamanho = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function Backup() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const { data, error } = await supabase.from('backups').select('id, criado_em, origem, tamanho').order('id', { ascending: false });
    if (error) setErro(error.message); else setLista(data);
  }
  useEffect(() => { carregar(); }, []);

  async function baixarCopia(b) {
    setErro('');
    const { data, error } = await supabase.from('backups').select('dados').eq('id', b.id).single();
    if (error) return setErro(error.message);
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(b.criado_em));
    baixar(`backup-controle-de-maquinas-${dia}.json`, JSON.stringify(data.dados, null, 1), 'application/json');
  }

  async function gerarEBaixar() {
    setOcupado(true); setErro('');
    const { data: id, error } = await supabase.rpc('gerar_backup', { p_origem: 'manual' });
    if (error) setErro(error.message);
    else { await baixarCopia({ id, criado_em: new Date().toISOString() }); await carregar(); }
    setOcupado(false);
  }

  return (
    <Tela titulo="Backup" voltar="/">
      <Aviso tom="ok">
        Toda semana (domingo de madrugada) o sistema guarda sozinho uma cópia de todos os dados. Ficam as 8 mais recentes.
      </Aviso>
      <Aviso>
        As cópias ficam no mesmo banco de dados do app. Para se proteger de uma perda do banco, baixe o arquivo de tempos em tempos
        e guarde fora (celular, e-mail, Google Drive). As fotos dos contadores e comprovantes não entram no arquivo.
      </Aviso>
      <Botao onClick={gerarEBaixar} disabled={ocupado} className="min-h-16 text-xl">{ocupado ? 'Gerando…' : 'Fazer backup agora e baixar'}</Botao>
      <Aviso tom="erro">{erro}</Aviso>

      <h2 className="px-1 pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Cópias guardadas</h2>
      {lista?.length === 0 && <Cartao>Nenhuma cópia ainda. A primeira automática sai no próximo domingo.</Cartao>}
      {lista?.map((b) => (
        <Cartao key={b.id} className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{dataHora(b.criado_em)}</div>
            <div className="text-sm text-slate-500">{b.origem === 'semanal' ? 'Automática da semana' : 'Feita na hora'} · {tamanho(b.tamanho)}</div>
          </div>
          <button onClick={() => baixarCopia(b)} className="min-h-12 rounded-lg bg-slate-900 px-4 font-semibold text-white">Baixar</button>
        </Cartao>
      ))}
    </Tela>
  );
}
