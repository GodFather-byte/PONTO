// Funcionamento com internet ruim:
//  - pontos e máquinas ficam guardados no aparelho (cache);
//  - a leitura é salva primeiro no aparelho (fila) e enviada quando houver sinal.
import { get, set } from 'idb-keyval';
import { supabase } from './supabase.js';

const CHAVE_FILA = 'fila-leituras';
const CHAVE_DADOS = 'cache-dados';
const ouvintes = new Set();

// Telas se inscrevem aqui para saber quando a fila mudou
export function aoMudarFila(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
const avisar = () => ouvintes.forEach((fn) => fn());

export const listarFila = async () => (await get(CHAVE_FILA)) ?? [];

// Erro de rede (sem sinal) é diferente de erro de regra (ex.: sem permissão)
const semSinal = (erro) => !navigator.onLine || /fetch|network|load failed/i.test(erro?.message ?? '');

// Com sinal fraco uma consulta pode demorar muito: desiste depois de alguns segundos
export const comLimite = (promessa, ms = 6000) => Promise.race([
  promessa, new Promise((_, falha) => setTimeout(() => falha(new Error('Sem resposta do servidor')), ms)),
]);

// ---------- Cache de pontos e máquinas ----------
export async function carregarDados() {
  try {
    if (!navigator.onLine) throw new Error('offline');
    const [pontos, maquinas, custos, fixas] = await comLimite(Promise.all([
      supabase.from('pontos').select('*').eq('ativo', true).order('nome'),
      supabase.from('maquinas').select('*').eq('ativa', true).order('codigo'),
      // Custos de manutenção que ainda vão entrar como despesa na próxima leitura do ponto
      supabase.from('manutencoes').select('id, ponto_id, data, problema, custo, maquinas(codigo)')
        .eq('destino', 'despesa_do_ponto').is('leitura_id', null).gt('custo', 0).order('data'),
      // Despesas fixas do mês que ainda não entraram em nenhuma leitura
      supabase.rpc('despesas_fixas_pendentes'),
    ]));
    if (pontos.error || maquinas.error || custos.error || fixas.error) throw pontos.error || maquinas.error || custos.error || fixas.error;
    const dados = { pontos: pontos.data, maquinas: maquinas.data, custosManutencao: custos.data, despesasFixas: fixas.data, atualizadoEm: new Date().toISOString() };
    // Leituras ainda não enviadas já contam como "leitura anterior"
    for (const item of await listarFila()) aplicarNoCache(dados, item.payload);
    await set(CHAVE_DADOS, dados);
    return { ...dados, offline: false };
  } catch {
    const dados = { pontos: [], maquinas: [], custosManutencao: [], despesasFixas: [], ...((await get(CHAVE_DADOS)) ?? {}) };
    return { ...dados, offline: true };
  }
}

function aplicarNoCache(dados, payload) {
  for (const m of payload.maquinas) {
    const maq = dados.maquinas.find((x) => x.id === m.maquina_id);
    if (maq) { maq.entrada_atual = m.entrada_atual; maq.saida_atual = m.saida_atual; }
  }
  // Custos de manutenção já lançados nesta leitura não são sugeridos de novo
  const usados = new Set(payload.despesas.map((d) => d.manutencao_id).filter(Boolean));
  if (usados.size) dados.custosManutencao = (dados.custosManutencao ?? []).filter((c) => !usados.has(c.id));
  // O mesmo vale para as despesas fixas do mês
  const fixasUsadas = new Set(payload.despesas.filter((d) => d.despesa_fixa_id).map((d) => `${d.despesa_fixa_id}|${d.competencia}`));
  if (fixasUsadas.size) dados.despesasFixas = (dados.despesasFixas ?? []).filter((f) => !fixasUsadas.has(`${f.id}|${f.competencia}`));
}

// ---------- Fila ----------
// item = { id, payload (vai para salvar_leitura), fotos: [{ caminho, blob }], resumo (para mostrar na tela) }
export async function enfileirar(item) {
  await set(CHAVE_FILA, [...(await listarFila()), { ...item, erro: null }]);
  const dados = await get(CHAVE_DADOS);
  if (dados) { aplicarNoCache(dados, item.payload); await set(CHAVE_DADOS, dados); }
  avisar();
}

export async function removerDaFila(id) {
  await set(CHAVE_FILA, (await listarFila()).filter((i) => i.id !== id));
  avisar();
}

let sincronizando = false;
// Envia tudo o que está na fila. Pode ser chamada quantas vezes quiser.
export async function sincronizar() {
  if (sincronizando || !supabase) return;
  sincronizando = true;
  try {
    for (const item of await listarFila()) {
      try {
        for (const foto of item.fotos ?? []) {
          const { error } = await supabase.storage.from('contadores')
            .upload(foto.caminho, foto.blob, { contentType: foto.blob.type || 'image/jpeg' });
          // "já existe" = foto enviada numa tentativa anterior; segue em frente
          if (error && !/exist|duplicate/i.test(error.message)) throw error;
        }
        const { error } = await supabase.rpc('salvar_leitura', { p: item.payload });
        if (error) throw error;
        await removerDaFila(item.id);
      } catch (erro) {
        if (semSinal(erro)) break; // sem internet: tenta de novo depois
        // erro de regra: guarda a mensagem para mostrar e segue para a próxima
        const fila = await listarFila();
        const alvo = fila.find((i) => i.id === item.id);
        if (alvo) { alvo.erro = erro.message ?? String(erro); await set(CHAVE_FILA, fila); avisar(); }
      }
    }
  } finally {
    sincronizando = false;
  }
}

// Tenta enviar ao abrir o app, quando o sinal volta e a cada minuto
export function iniciarSincronizacao() {
  sincronizar();
  window.addEventListener('online', sincronizar);
  setInterval(sincronizar, 60_000);
}
