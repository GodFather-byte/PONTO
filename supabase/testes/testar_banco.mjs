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
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('teste.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
`);
// Aplica as migrações na ordem (a 0002 é só do Storage do Supabase e fica de fora)
for (const arquivo of ['0001_estrutura.sql', '0003_pagamentos.sql', '0004_manutencao_assinatura.sql', '0005_fixas_backup_prospeccao.sql']) {
  await db.exec(readFileSync(new URL(`../migrations/${arquivo}`, import.meta.url), 'utf8'));
}
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

r = await db.query(`select * from calcular_divisao(-500, 0, 40, 'so_da_empresa')`);
d = r.rows[0];
ok('Resultado negativo: ponto fica com zero, empresa assume', +d.parte_ponto === 0 && +d.parte_empresa === -500);

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

// ---------- Edição pelo Admin ----------
const L2 = '30000000-0000-0000-0000-000000000002';
const edicao = `select editar_leitura('${L2}', '${JSON.stringify({
  ponto_pago_na_hora: true, valor_recolhido: 30,
  maquinas: [{ maquina_id: M1, entrada_atual: 300, saida_atual: 50 }], despesas: [],
})}'::jsonb, 'Erro de digitação')`;
r = await como(OPER, edicao);
ok('Operador não edita leitura salva', /Somente o Admin/.test(r.erro ?? ''));
r = await como(ADMIN, edicao);
d = (await db.query(`select l.*, (select count(*)::int from leitura_alteracoes where leitura_id = l.id) alt,
                     (select entrada_atual from maquinas where id = '${M1}') maq from leituras l where id = '${L2}'`)).rows[0];
ok('Admin edita, contas são refeitas e o histórico é gravado', !r.erro && +d.resultado === 250 && +d.parte_ponto === 100 &&
  +d.caixa_apos_ponto === 150 && +d.diferenca === -120 && d.alt === 1 && +d.maq === 300,
  r.erro ?? `resultado ${d.resultado}, ponto ${d.parte_ponto}, diferença ${d.diferenca}`);

// ---------- Pagamentos aos pontos (Versão 2) ----------
r = await como(DONO1, `select registrar_pagamento('${L1}', current_date, 'pix')`);
ok('Dono não registra pagamento', /Sem permissão/.test(r.erro ?? ''));
r = await como(OPER, `select registrar_pagamento('${L1}', current_date, 'pix', 'p/l/comprovante.jpg')`);
d = (await db.query(`select pago_em, pago_forma, pago_comprovante, pago_por from leituras where id = '${L1}'`)).rows[0];
ok('Operador registra pagamento (Pix, com comprovante)', !r.erro && d.pago_em && d.pago_forma === 'pix' && d.pago_comprovante && d.pago_por === OPER, r.erro);
r = await como(OPER, `select registrar_pagamento('${L1}', current_date, 'dinheiro')`);
ok('Pagamento em dobro é recusado', /já foi registrado/.test(r.erro ?? ''));
r = await como(DONO1, `select pago_forma from leituras where id = '${L1}'`);
ok('Dono vê o pagamento do próprio ponto', r.linhas?.[0]?.pago_forma === 'pix');
r = await como(OPER, `select desfazer_pagamento('${L1}')`);
ok('Operador não desfaz pagamento', /Somente o Admin/.test(r.erro ?? ''));
r = await como(ADMIN, `select desfazer_pagamento('${L1}')`);
d = (await db.query(`select pago_em from leituras where id = '${L1}'`)).rows[0];
ok('Admin desfaz pagamento', !r.erro && d.pago_em === null, r.erro);
d = (await db.query(`select pago_em, pago_forma, ponto_pago_na_hora from leituras where id = '${L2}'`)).rows[0];
ok('Leitura "paga na hora" já nasce paga em dinheiro', d.ponto_pago_na_hora && d.pago_em && d.pago_forma === 'dinheiro');
r = await como(ADMIN, `select desfazer_pagamento('${L2}')`);
ok('Pagamento "na hora" só muda pela edição da leitura', /Editar leitura/.test(r.erro ?? ''));

// ---------- Manutenção e assinatura (Versão 2) ----------
const manut = (extra) => `select registrar_manutencao('${JSON.stringify({ maquina_id: M1, problema: 'Noteiro travando', custo: 150, ...extra })}'::jsonb) id`;
r = await como(DONO1, manut({}));
ok('Dono não registra manutenção', /Sem permissão/.test(r.erro ?? ''));
r = await como(OPER, manut({ status: 'com_defeito', destino: 'despesa_do_ponto', peca_trocada: 'Noteiro', quem_fez: 'Técnico Beto' }));
const MAN = r.linhas?.[0]?.id;
d = (await db.query(`select status from maquinas where id = '${M1}'`)).rows[0];
ok('Operador registra ocorrência e o status da máquina muda', !r.erro && d.status === 'com_defeito', r.erro);
await como(ADMIN, manut({ status: 'funcionando', destino: 'so_da_empresa', custo: 80 }));
r = await como(DONO1, `select count(*)::int n from manutencoes`);
ok('Dono não vê o histórico de manutenção', r.linhas?.[0].n === 0);
r = await como(OPER, `select count(*)::int n from manutencoes`);
ok('Operador vê as ocorrências do ponto dele', r.linhas?.[0].n === 2);

const comManut = (id, ent, sai) => `select salvar_leitura('${JSON.stringify({
  id, ponto_id: P1, assinatura_caminho: `${P1}/${id}/assinatura.png`, assinatura_nome: 'Zé',
  maquinas: [{ maquina_id: M1, entrada_atual: ent, saida_atual: sai }],
  despesas: [{ descricao: 'Manutenção 001: Noteiro travando', valor: 150, categoria: 'manutencao', manutencao_id: MAN }],
})}'::jsonb)`;
const L5 = '30000000-0000-0000-0000-000000000005', L6 = '30000000-0000-0000-0000-000000000006';
r = await como(OPER, comManut(L5, 1300, 50));
d = (await db.query(`select l.total_despesas, l.assinatura_nome, l.assinatura_caminho, (select leitura_id from manutencoes where id = '${MAN}') lid from leituras l where id = '${L5}'`)).rows[0];
ok('Custo de manutenção entra como despesa da leitura, com assinatura guardada',
  !r.erro && +d.total_despesas === 150 && d.lid === L5 && d.assinatura_nome === 'Zé' && d.assinatura_caminho, r.erro);
r = await como(OPER, comManut(L6, 1400, 50));
d = (await db.query(`select total_despesas from leituras where id = '${L6}'`)).rows[0];
ok('O mesmo custo não é cobrado duas vezes', !r.erro && +d.total_despesas === 0, r.erro);

// ---------- Despesas fixas, backup e prospecção (Versão 2) ----------
await como(ADMIN, `insert into despesas_fixas (id, ponto_id, descricao, categoria, valor, dia_do_mes)
                   values ('40000000-0000-0000-0000-000000000001', '${P1}', 'Aluguel do espaço', 'outros', 300, 1)`);
r = await como(OPER, `select * from despesas_fixas_pendentes()`);
const comp = r.linhas?.[0]?.competencia;
ok('Despesa fixa vencida aparece como pendente para o operador do ponto', r.linhas?.length === 1 && +r.linhas[0].valor === 300, r.erro);
r = await como(DONO1, `select * from despesas_fixas_pendentes()`);
ok('Dono não vê despesas fixas', r.linhas?.length === 0);
const comFixa = (id, ent) => `select salvar_leitura('${JSON.stringify({
  id, ponto_id: P1, maquinas: [{ maquina_id: M1, entrada_atual: ent, saida_atual: 50 }],
  despesas: [{ descricao: 'Aluguel do espaço', valor: 1, despesa_fixa_id: '40000000-0000-0000-0000-000000000001', competencia: comp },
             { descricao: 'Lanche', valor: 20, categoria: 'outros' }],
})}'::jsonb)`;
const L7 = '30000000-0000-0000-0000-000000000007', L8 = '30000000-0000-0000-0000-000000000008';
r = await como(OPER, comFixa(L7, 1500));
d = (await db.query(`select total_despesas from leituras where id = '${L7}'`)).rows[0];
ok('Despesa fixa entra na leitura com o valor do cadastro (300 + 20)', !r.erro && +d.total_despesas === 320, r.erro);
r = await como(OPER, comFixa(L8, 1600));
d = (await db.query(`select total_despesas from leituras where id = '${L8}'`)).rows[0];
ok('A mesma despesa fixa não entra duas vezes no mês', !r.erro && +d.total_despesas === 20, r.erro);
r = await como(OPER, `select * from despesas_fixas_pendentes()`);
ok('Depois de lançada, deixa de aparecer como pendente', r.linhas?.length === 0);

r = await como(OPER, `select gerar_backup()`);
ok('Operador não gera backup', /Somente o Admin/.test(r.erro ?? ''));
r = await como(ADMIN, `select gerar_backup() id`);
d = (await db.query(`select jsonb_array_length(dados->'leituras') n, dados ? 'pontos' p, tamanho from backups order by id desc limit 1`)).rows[0];
ok('Admin gera backup com todos os dados', !r.erro && d.n >= 6 && d.p && d.tamanho > 1000, r.erro);
r = await como(OPER, `select count(*)::int n from backups`);
ok('Só o Admin enxerga os backups', r.linhas?.[0].n === 0);

await como(ADMIN, `insert into prospectos (id, nome, endereco, contato, percentual_proposto) values
                   ('50000000-0000-0000-0000-000000000001', 'Padaria Central', 'Rua B, 20', '(11) 98888-7777', 35)`);
r = await como(OPER, `select count(*)::int n from prospectos`);
ok('Operador não vê a prospecção', r.linhas?.[0].n === 0);
r = await como(ADMIN, `select converter_prospecto('50000000-0000-0000-0000-000000000001') id`);
d = (await db.query(`select p.nome, p.telefone, p.percentual_ponto, x.status from pontos p join prospectos x on x.ponto_id = p.id`)).rows[0];
ok('Prospecto fechado vira ponto cadastrado', !r.erro && d?.nome === 'Padaria Central' && d.telefone === '11988887777' && +d.percentual_ponto === 35 && d.status === 'fechado', r.erro);

// ---------- Troca de ponto ----------
await como(ADMIN, `update maquinas set ponto_id = '${P2}' where id = '${M1}'`);
r = await db.query(`select count(*)::int n from maquina_movimentacoes where maquina_id = '${M1}'`);
const hist = await como(DONO1, `select count(*)::int n from leitura_maquinas where maquina_id = '${M1}'`);
ok('Admin troca máquina de ponto e o histórico fica', r.rows[0].n === 2 && hist.linhas?.[0].n === 6);

console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.');
process.exit(falhas ? 1 : 0);
