// Entrar ou criar conta. Toda conta nova nasce sem acesso; o Admin libera depois.
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Tela, Cartao, Campo, Botao, Aviso } from '../componentes/ui.jsx';

const ERROS = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Este e-mail já tem conta. Use "Entrar".',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
};

export default function Login() {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setMsg(null); setOcupado(true);
    const { data, error } = criando
      ? await supabase.auth.signUp({ email, password: senha, options: { data: { nome } } })
      : await supabase.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) setMsg({ tom: 'erro', texto: ERROS[error.message] ?? error.message });
    else if (criando && !data.session) setMsg({ tom: 'ok', texto: 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.' });
  }

  return (
    <Tela titulo="Controle de Máquinas">
      <Cartao>
        <form onSubmit={enviar} className="space-y-4">
          <h2 className="text-xl font-semibold">{criando ? 'Criar conta' : 'Entrar'}</h2>
          {criando && <Campo rotulo="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />}
          <Campo rotulo="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Campo rotulo="Senha" type="password" minLength={6} autoComplete={criando ? 'new-password' : 'current-password'}
            value={senha} onChange={(e) => setSenha(e.target.value)} required />
          <Aviso tom={msg?.tom}>{msg?.texto}</Aviso>
          <Botao type="submit" disabled={ocupado}>{ocupado ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}</Botao>
        </form>
      </Cartao>
      <Botao cor="claro" onClick={() => { setCriando(!criando); setMsg(null); }}>
        {criando ? 'Já tenho conta' : 'Criar conta nova'}
      </Botao>
    </Tela>
  );
}
