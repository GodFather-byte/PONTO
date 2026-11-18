// Usuários (Admin): define o papel de cada conta e a quais pontos ela tem acesso
// O banco só entrega ao Admin a própria conta e as contas de operadores e donos (nunca outros Admins).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useSessao } from '../lib/sessao.jsx';
import { Tela, Cartao, Selecao, Botao, Marcador, Aviso } from '../componentes/ui.jsx';

// Promover a Admin não é feito pelo app: cada Admin só enxerga e gerencia operadores e donos de ponto
const PAPEIS = { operador: 'Operador (faz leitura)', dono: 'Dono do ponto (só visualiza)' };

function CartaoUsuario({ usuario, pontos, vinculos, eu, aoSalvar }) {
  const [papel, setPapel] = useState(usuario.papel);
  const [ativo, setAtivo] = useState(usuario.ativo);
  const [marcados, setMarcados] = useState(new Set(vinculos));
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const alternar = (id, sim) => { const s = new Set(marcados); sim ? s.add(id) : s.delete(id); setMarcados(s); };

  async function salvar() {
    setOcupado(true); setMsg(null);
    let { error } = await supabase.from('perfis').update({ papel, ativo }).eq('id', usuario.id);
    if (!error) ({ error } = await supabase.from('usuario_pontos').delete().eq('usuario_id', usuario.id));
    if (!error && marcados.size) {
      ({ error } = await supabase.from('usuario_pontos')
        .insert([...marcados].map((ponto_id) => ({ usuario_id: usuario.id, ponto_id }))));
    }
    setOcupado(false);
    setMsg(error ? { tom: 'erro', texto: error.message } : { tom: 'ok', texto: 'Salvo.' });
    if (!error) aoSalvar();
  }

  return (
    <Cartao className="space-y-3">
      <div>
        <div className="text-lg font-semibold">{usuario.nome || '(sem nome)'}{eu ? ' — você' : ''}</div>
        <div className="text-sm text-slate-500">{usuario.email}</div>
      </div>
      {/* O Admin não rebaixa nem desativa a própria conta, para não se trancar para fora */}
      {!eu && <>
        <Selecao rotulo="Papel" value={papel} onChange={(e) => setPapel(e.target.value)}>
          {Object.entries(PAPEIS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </Selecao>
        <Marcador rotulo="Conta ativa" checked={ativo} onChange={setAtivo} />
        {(
          <div>
            <div className="text-sm font-medium text-slate-600">Pontos liberados</div>
            {pontos.length === 0 && <div className="text-sm text-slate-500">Cadastre um ponto primeiro.</div>}
            {pontos.map((p) => (
              <Marcador key={p.id} rotulo={p.nome} checked={marcados.has(p.id)} onChange={(sim) => alternar(p.id, sim)} />
            ))}
          </div>
        )}
        <Aviso tom={msg?.tom}>{msg?.texto}</Aviso>
        <Botao cor="escuro" onClick={salvar} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Botao>
      </>}
    </Cartao>
  );
}

export default function Usuarios() {
  const { perfil } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  async function carregar() {
    const [u, p, v] = await Promise.all([
      supabase.from('perfis').select('*').order('criado_em'),
      supabase.from('pontos').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('usuario_pontos').select('*'),
    ]);
    const falha = u.error || p.error || v.error;
    if (falha) setErro(falha.message); else setDados({ usuarios: u.data, pontos: p.data, vinculos: v.data });
  }
  useEffect(() => { carregar(); }, []);

  return (
    <Tela titulo="Usuários" voltar="/">
      <Aviso tom="ok">
        Para incluir alguém: a pessoa abre o app, toca em "Criar conta nova" e aparece aqui. Depois é só escolher o papel e os pontos.
      </Aviso>
      <Aviso tom="erro">{erro}</Aviso>
      {dados?.usuarios.map((u) => (
        <CartaoUsuario key={u.id} usuario={u} pontos={dados.pontos} eu={u.id === perfil.id} aoSalvar={carregar}
          vinculos={dados.vinculos.filter((v) => v.usuario_id === u.id).map((v) => v.ponto_id)} />
      ))}
    </Tela>
  );
}
