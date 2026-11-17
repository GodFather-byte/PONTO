// Teste da Etapa 1: sobe um Postgres em memória (PGlite), aplica a migração
// e confere os cálculos e as regras de acesso.
// Rodar: npm install && npm run testar:banco
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
let falhas = 0;
const ok = (nome, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${nome}${extra ? ' — ' + extra : ''}`);
  if (!cond) falhas++;
};

// Imitação mínima do que o Supabase já traz pronto (login e papéis)
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
`);
await db.exec(readFileSync(new URL('../migrations/0001_estrutura.sql', import.meta.url), 'utf8'));
// No Supabase estes grants já vêm por padrão; quem restringe é o RLS
await db.exec(`
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant usage on all sequences in schema public to authenticated;
`);

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const OPER  = '00000000-0000-0000-0000-00000000000b';
const DONO1 = '00000000-0000-0000-0000-00000000000c';
const DONO2 = '00000000-0000-0000-0000-00000000000d';
const P1 = '10000000-0000-0000-0000-000000000001';
const P2 = '10000000-0000-0000-0000-000000000002';
const M1 = '20000000-0000-0000-0000-000000000001';
const M2 = '20000000-0000-0000-0000-000000000002';
const L1 = '30000000-0000-0000-0000-000000000001';

// Dados de exemplo (como superusuário)
await db.exec(`
  insert into auth.users values
    ('${ADMIN}', '{"nome":"Admin"}'), ('${OPER}', '{"nome":"Operador"}'),
    ('${DONO1}', '{"nome":"Dono 1"}'), ('${DONO2}', '{"nome":"Dono 2"}');
  update perfis set papel = 'admin'    where id = '${ADMIN}';
  update perfis set papel = 'operador' where id = '${OPER}';
  insert into pontos (id, nome, percentual_ponto, regra_despesa) values
    ('${P1}', 'Bar do Zé', 40, 'so_da_empresa'),
    ('${P2}', 'Lanchonete', 50, 'antes_da_divisao');
  insert into usuario_pontos values ('${OPER}', '${P1}'), ('${DONO1}', '${P1}'), ('${DONO2}', '${P2}');
  insert into maquinas (id, codigo, nome_jogo, ponto_id, leitura_inicial_entrada, leitura_inicial_saida) values
    ('${M1}', '001', 'Jogo A', '${P1}', 50000, 20000),
    ('${M2}', '002', 'Jogo B', '${P2}', 0, 0);
`);

// Executa SQL "logado" como um usuário, passando pelo RLS
async function como(uid, sql) {
  await db.exec(`set role authenticated; select set_config('teste.uid', '${uid}', false);`);
  try { return { linhas: (await db.query(sql)).rows }; }
  catch (e) { return { erro: e.message }; }
  finally { await db.exec(`reset role; select set_config('teste.uid', '', false);`); }
}
const leitura = (id, ponto, maq, ent, sai, extra = {}) => `select salvar_leitura('${JSON.stringify({
  id, ponto_id: ponto, valor_recolhido: 4000,
  maquinas: [{ maquina_id: maq, entrada_atual: ent, saida_atual: sai, ...extra }],
  despesas: [{ descricao: 'Manutenção', valor: 1000, categoria: 'manutencao' }],
})}'::jsonb)`;

// ---------- Cálculos ----------
let r = await db.query(`select * from calcular_divisao(5000, 1000, 40, 'so_da_empresa')`);
let d = r.rows[0];
ok('Exemplo do pedido (regra "só da empresa")',
  +d.parte_ponto === 2000 && +d.parte_empresa === 2000 && +d.caixa_esperado === 4000 && +d.caixa_apos_ponto === 2000,
  `ponto ${d.parte_ponto}, empresa ${d.parte_empresa}, caixa ${d.caixa_esperado} → ${d.caixa_apos_ponto}`);

r = await db.query(`select * from calcular_divisao(5000, 1000, 40, 'antes_da_divisao')`);
d = r.rows[0];
ok('Mesmo exemplo com regra "antes da divisão"',
  +d.parte_ponto === 1600 && +d.parte_empresa === 2400 && +d.caixa_esperado === 4000,
  `ponto ${d.parte_ponto}, empresa ${d.parte_empresa}`);

// ---------- Salvar leitura ----------
r = await como(OPER, leitura(L1, P1, M1, 60000, 25000));
ok('Operador salva leitura no ponto dele', !r.erro, r.erro);
r = await db.query(`select * from leituras where id = '${L1}'`);
d = r.rows[0];
ok('Leitura salva com as contas certas (entrada 10.000, saída 5.000)',
  +d.total_entrada === 10000 && +d.total_saida === 5000 && +d.resultado === 5000 &&
  +d.parte_ponto === 2000 && +d.parte_empresa === 2000 && +d.caixa_esperado === 4000 && +d.diferenca === 0);

await como(OPER, leitura(L1, P1, M1, 60000, 25000));
r = await db.query(`select count(*)::int n from leituras`);
ok('Reenviar a mesma leitura (offline) não duplica', r.rows[0].n === 1);

r = await como(OPER, leitura('30000000-0000-0000-0000-000000000002', P1, M1, 100, 50));
ok('Leitura menor que a anterior é recusada', /menor que a anterior/.test(r.erro ?? ''));
r = await como(OPER, leitura('30000000-0000-0000-0000-000000000002', P1, M1, 100, 50, { contador_zerado: true }));
d = (await db.query(`select * from leituras where id = '30000000-0000-0000-0000-000000000002'`)).rows[0];
ok('"Contador zerado" usa a nova leitura como base', !r.erro && +d.total_entrada === 100 && +d.total_saida === 50);

r = await como(OPER, leitura('30000000-0000-0000-0000-000000000003', P2, M2, 10, 5));
ok('Operador NÃO salva leitura em ponto de outro', /sem acesso/.test(r.erro ?? ''));

// ---------- Regras de acesso ----------
r = await como(OPER, `select id from pontos`);
ok('Operador só vê o ponto atribuído', r.linhas?.length === 1 && r.linhas[0].id === P1);
r = await como(DONO1, `select ponto_id from leituras`);
ok('Dono 1 vê as leituras do próprio ponto', r.linhas?.length === 2);
r = await como(DONO2, `select (select count(*) from leituras)::int l, (select count(*) from despesas)::int d,
                              (select count(*) from leitura_maquinas)::int m, (select count(*) from pontos)::int p`);
ok('Dono 2 não vê nada do ponto do Dono 1', r.linhas?.[0].l === 0 && r.linhas[0].d === 0 && r.linhas[0].m === 0 && r.linhas[0].p === 1);

r = await como(DONO1, leitura('30000000-0000-0000-0000-000000000004', P1, M1, 200, 60));
ok('Dono não consegue registrar leitura', /Sem permissão/.test(r.erro ?? ''));
await como(DONO1, `update leituras set parte_ponto = 99999`);
await como(DONO1, `delete from despesas`);
await como(OPER,  `update leituras set valor_recolhido = 1`);
await como(OPER,  `update pontos set percentual_ponto = 0`);
r = await db.query(`select (select max(parte_ponto) from leituras) pp, (select count(*)::int from despesas) nd,
                           (select valor_recolhido from leituras where id='${L1}') vr,
                           (select percentual_ponto from pontos where id='${P1}') pct`);
d = r.rows[0];
ok('Dono e operador não alteram nem apagam nada', +d.pp === 2000 && d.nd === 2 && +d.vr === 4000 && +d.pct === 40);
r = await como(DONO1, `update perfis set papel = 'admin' where id = '${DONO1}' returning id`);
ok('Ninguém consegue se promover a admin', !r.linhas?.length);

r = await como(DONO2, `select conferir_leitura('${L1}')`);
ok('Dono 2 não confere leitura do ponto do Dono 1', !!r.erro);
r = await como(DONO1, `select conferir_leitura('${L1}')`);
d = (await db.query(`select conferido_em, conferido_por from leituras where id = '${L1}'`)).rows[0];
ok('Dono 1 marca "Conferido" (data e hora gravadas)', !r.erro && d.conferido_em && d.conferido_por === DONO1);

// ---------- Troca de ponto ----------
await como(ADMIN, `update maquinas set ponto_id = '${P2}' where id = '${M1}'`);
r = await db.query(`select count(*)::int n from maquina_movimentacoes where maquina_id = '${M1}'`);
const hist = await como(DONO1, `select count(*)::int n from leitura_maquinas where maquina_id = '${M1}'`);
ok('Admin troca máquina de ponto e o histórico fica', r.rows[0].n === 2 && hist.linhas?.[0].n === 2);

console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
