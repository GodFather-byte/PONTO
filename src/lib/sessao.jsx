// Sessão: quem está logado e qual o papel (admin, operador ou dono)
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const Contexto = createContext(null);
export const useSessao = () => useContext(Contexto);

const CHAVE = 'perfil';
const perfilGuardado = () => { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; } };

export function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = ainda carregando
  const [perfil, setPerfil] = useState(perfilGuardado());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setUsuario(sessao?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Busca o perfil; sem sinal, usa o que ficou guardado no aparelho
  async function recarregarPerfil(id = usuario?.id) {
    if (!id) return;
    const { data } = await supabase.from('perfis').select('*').eq('id', id).maybeSingle();
    if (data) { setPerfil(data); localStorage.setItem(CHAVE, JSON.stringify(data)); }
  }

  useEffect(() => {
    if (usuario === null) { setPerfil(null); localStorage.removeItem(CHAVE); }
    else if (usuario) recarregarPerfil(usuario.id).catch(() => {});
  }, [usuario?.id]);

  const sair = () => supabase.auth.signOut();
  const perfilValido = perfil && usuario && perfil.id === usuario.id ? perfil : null;

  return (
    <Contexto.Provider value={{ usuario, perfil: perfilValido, sair, recarregarPerfil,
      carregando: usuario === undefined || (usuario && !perfilValido) }}>
      {children}
    </Contexto.Provider>
  );
}
