// Conexão com o Supabase (banco, login e fotos)
import { createClient } from '@supabase/supabase-js';

const env = import.meta.env ?? {}; // fora do navegador (testes) não há variáveis
const url = env.VITE_SUPABASE_URL;
const chave = env.VITE_SUPABASE_ANON_KEY;

// Sem as variáveis configuradas o app mostra um aviso em vez de quebrar
export const configurado = Boolean(url && chave);
export const supabase = configurado ? createClient(url, chave) : null;
