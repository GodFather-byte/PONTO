-- =====================================================================
-- CONTROLE DE MÁQUINAS — Etapa 1: estrutura do banco e regras de acesso
-- Rodar no Supabase: SQL Editor > colar este arquivo > Run.
-- =====================================================================
-- Resumo das regras de acesso (Row Level Security):
--   admin    -> vê e altera tudo.
--   operador -> vê só os pontos atribuídos a ele; registra leitura SOMENTE
--               pela função salvar_leitura(); não edita nem apaga nada.
--   dono     -> só VISUALIZA os pontos dele; única ação é conferir_leitura().
-- Todo cálculo de dinheiro é refeito no servidor (o celular só mostra prévia).
-- =====================================================================


-- ---------- Tipos ----------
create type papel_usuario      as enum ('admin', 'operador', 'dono');
create type regra_despesa      as enum ('antes_da_divisao', 'so_da_empresa');
create type categoria_despesa  as enum ('salario', 'produto', 'manutencao', 'sangria', 'outros');

-- ---------- Perfis (1 linha por usuário do login) ----------
create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  email      text not null default '',
  papel      papel_usuario not null default 'dono',  -- nasce com o menor acesso
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- ---------- Pontos (estabelecimentos) ----------
create table pontos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  endereco          text not null default '',
  telefone          text not null default '',   -- WhatsApp do responsável (só números, com DDD)
  percentual_ponto  numeric(5,2) not null default 0 check (percentual_ponto between 0 and 100),
  regra_despesa     regra_despesa not null default 'antes_da_divisao',
  observacoes       text not null default '',
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);

-- ---------- Quem acessa qual ponto (operadores e donos) ----------
create table usuario_pontos (
  usuario_id  uuid not null references perfis(id) on delete cascade,
  ponto_id    uuid not null references pontos(id) on delete cascade,
  primary key (usuario_id, ponto_id)
);
create index on usuario_pontos (ponto_id);

-- ---------- Máquinas ----------
create table maquinas (
  id                       uuid primary key default gen_random_uuid(),
  codigo                   text not null unique,          -- número/código da máquina
  nome_jogo                text not null default '',
  ponto_id                 uuid references pontos(id),     -- nulo = em estoque
  leitura_inicial_entrada  numeric(14,2) not null default 0 check (leitura_inicial_entrada >= 0),
  leitura_inicial_saida    numeric(14,2) not null default 0 check (leitura_inicial_saida >= 0),
  -- Última leitura conhecida (vira a "leitura anterior" da próxima leitura)
  entrada_atual            numeric(14,2),
  saida_atual              numeric(14,2),
  data_instalacao          date not null default current_date,
  ativa                    boolean not null default true,
  qr_token                 uuid not null default gen_random_uuid() unique, -- V2: QR code
  criado_em                timestamptz not null default now()
);
create index on maquinas (ponto_id);

-- Histórico de troca de ponto (preenchido sozinho por gatilho)
create table maquina_movimentacoes (
  id             bigint generated always as identity primary key,
  maquina_id     uuid not null references maquinas(id) on delete cascade,
  ponto_origem   uuid references pontos(id),
  ponto_destino  uuid references pontos(id),
  movido_em      timestamptz not null default now(),
  movido_por     uuid references perfis(id)
);
create index on maquina_movimentacoes (maquina_id);

-- ---------- Leituras ----------
create table leituras (
  id                uuid primary key,              -- gerado no celular (permite salvar offline sem duplicar)
  ponto_id          uuid not null references pontos(id),
  data_hora         timestamptz not null,          -- quando a leitura foi feita
  data_local        date not null,                 -- dia no fuso America/Sao_Paulo (para relatórios)
  sincronizado_em   timestamptz not null default now(),
  operador_id       uuid not null references perfis(id),
  operador_nome     text not null default '',
  -- Regras do ponto "congeladas" no momento da leitura
  percentual_ponto  numeric(5,2) not null,
  regra_despesa     regra_despesa not null,
  -- Totais (calculados no servidor)
  total_entrada     numeric(14,2) not null default 0,
  total_saida       numeric(14,2) not null default 0,
  resultado         numeric(14,2) not null default 0,
  total_despesas    numeric(14,2) not null default 0,
  parte_ponto       numeric(14,2) not null default 0,
  parte_empresa     numeric(14,2) not null default 0,
  caixa_esperado    numeric(14,2) not null default 0,  -- antes de pagar o ponto
  caixa_apos_ponto  numeric(14,2) not null default 0,  -- depois de pagar o ponto
  ponto_pago_na_hora boolean not null default false,  -- operador já pagou a parte do ponto?
  valor_recolhido   numeric(14,2),
  diferenca         numeric(14,2),  -- recolhido − caixa (após o ponto, se foi pago na hora; senão o esperado)
  observacao        text not null default '',
  -- "Conferido" pelo dono do ponto
  conferido_em      timestamptz,
  conferido_por     uuid references perfis(id)
);
create index on leituras (ponto_id, data_hora desc);
create index on leituras (data_local);

create table leitura_maquinas (
  id                bigint generated always as identity primary key,
  leitura_id        uuid not null references leituras(id) on delete cascade,
  maquina_id        uuid not null references maquinas(id),
  entrada_anterior  numeric(14,2) not null,
  saida_anterior    numeric(14,2) not null,
  entrada_atual     numeric(14,2) not null check (entrada_atual >= 0),
  saida_atual       numeric(14,2) not null check (saida_atual >= 0),
  contador_zerado   boolean not null default false,
  entrada_periodo   numeric(14,2) not null,
  saida_periodo     numeric(14,2) not null,
  resultado         numeric(14,2) not null,
  foto_caminho      text,                           -- arquivo no bucket "contadores"
  unique (leitura_id, maquina_id)
);
create index on leitura_maquinas (maquina_id);

create table despesas (
  id          bigint generated always as identity primary key,
  leitura_id  uuid not null references leituras(id) on delete cascade,
  descricao   text not null,
  valor       numeric(14,2) not null check (valor > 0),
  categoria   categoria_despesa not null default 'outros'
);
create index on despesas (leitura_id);

-- Histórico de edições feitas pelo Admin em leituras já salvas
create table leitura_alteracoes (
  id            bigint generated always as identity primary key,
  leitura_id    uuid not null references leituras(id) on delete cascade,
  alterado_por  uuid not null references perfis(id),
  alterado_em   timestamptz not null default now(),
  motivo        text not null default '',
  dados_antes   jsonb not null,
  dados_depois  jsonb not null
);
create index on leitura_alteracoes (leitura_id);

-- Configurações gerais (sempre 1 linha só)
create table configuracoes (
  id                boolean primary key default true check (id),
  dias_sem_leitura  integer not null default 7 check (dias_sem_leitura > 0)
);
insert into configuracoes default values;

-- =====================================================================
-- Funções de apoio às regras de acesso
-- =====================================================================
create function papel_atual() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create function eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_atual() = 'admin', false)
$$;

-- Admin acessa todos; operador e dono só os pontos ligados a eles
create function tem_acesso_ponto(p_ponto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin() or (
    papel_atual() is not null and exists (
      select 1 from usuario_pontos
      where usuario_id = auth.uid() and ponto_id = p_ponto
    )
  )
$$;

-- =====================================================================
-- Cálculo da divisão (única fonte da verdade das contas)
-- =====================================================================
create function calcular_divisao(
  p_resultado numeric, p_despesas numeric, p_percentual numeric, p_regra regra_despesa
) returns table (parte_ponto numeric, parte_empresa numeric, caixa_esperado numeric, caixa_apos_ponto numeric)
language plpgsql immutable set search_path = public as $$
declare
  v_base numeric;
begin
  if p_regra = 'antes_da_divisao' then
    -- despesa sai antes: os dois lados dividem o que sobrou
    v_base        := p_resultado - p_despesas;
    -- resultado negativo: o ponto não divide prejuízo (fica com zero)
    parte_ponto   := greatest(0, round(v_base * p_percentual / 100, 2));
    parte_empresa := v_base - parte_ponto;
  else
    -- despesa sai só da parte da empresa
    parte_ponto   := greatest(0, round(p_resultado * p_percentual / 100, 2));
    parte_empresa := p_resultado - parte_ponto - p_despesas;
  end if;
  caixa_esperado   := p_resultado - p_despesas;        -- antes de pagar o ponto
  caixa_apos_ponto := caixa_esperado - parte_ponto;    -- = parte da empresa
  return next;
end $$;

-- =====================================================================
-- Gatilhos
-- =====================================================================
-- Cria o perfil quando alguém se cadastra (sempre com o menor acesso)
create function criar_perfil_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), coalesce(new.email, ''));
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function criar_perfil_novo_usuario();

-- Máquina nova: a leitura inicial vira a "última leitura conhecida"
create function maquina_antes_inserir() returns trigger
language plpgsql set search_path = public as $$
begin
  new.entrada_atual := coalesce(new.entrada_atual, new.leitura_inicial_entrada);
  new.saida_atual   := coalesce(new.saida_atual,   new.leitura_inicial_saida);
  return new;
end $$;

create trigger maquina_bi before insert on maquinas
  for each row execute function maquina_antes_inserir();

-- Troca de ponto: registra no histórico (as leituras antigas continuam no ponto antigo)
create function maquina_registrar_movimentacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.ponto_id is distinct from old.ponto_id then
    insert into maquina_movimentacoes (maquina_id, ponto_origem, ponto_destino, movido_por)
    values (new.id, case when tg_op = 'UPDATE' then old.ponto_id end, new.ponto_id, auth.uid());
  end if;
  return new;
end $$;

create trigger maquina_aiu after insert or update on maquinas
  for each row execute function maquina_registrar_movimentacao();

-- =====================================================================
-- Funções internas (não são chamadas direto pelo app)
-- =====================================================================
-- Soma máquinas e despesas da leitura e refaz divisão, caixa e diferença
create function recalcular_leitura(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_l    leituras%rowtype;
  v_ent  numeric;  v_sai numeric;  v_desp numeric;
  v_div  record;
begin
  select * into v_l from leituras where id = p_id;
  select coalesce(sum(entrada_periodo), 0), coalesce(sum(saida_periodo), 0)
    into v_ent, v_sai from leitura_maquinas where leitura_id = p_id;
  select coalesce(sum(valor), 0) into v_desp from despesas where leitura_id = p_id;
  select * into v_div from calcular_divisao(v_ent - v_sai, v_desp, v_l.percentual_ponto, v_l.regra_despesa);

  update leituras set
    total_entrada = v_ent, total_saida = v_sai, resultado = v_ent - v_sai, total_despesas = v_desp,
    parte_ponto = v_div.parte_ponto, parte_empresa = v_div.parte_empresa,
    caixa_esperado = v_div.caixa_esperado, caixa_apos_ponto = v_div.caixa_apos_ponto,
    diferenca = valor_recolhido - case when ponto_pago_na_hora then v_div.caixa_apos_ponto
                                       else v_div.caixa_esperado end
  where id = p_id;
end $$;

-- Fotografia completa da leitura (usada no histórico de alterações)
create function leitura_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'leitura',  to_jsonb(l),
    'maquinas', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from leitura_maquinas m where m.leitura_id = l.id),
    'despesas', (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]') from despesas d where d.leitura_id = l.id))
  from leituras l where l.id = p_id
$$;

-- =====================================================================
-- Salvar leitura (admin e operador). Tudo ou nada, e refaz as contas.
-- Formato do JSON:
-- { "id": uuid, "ponto_id": uuid, "data_hora": "...", "valor_recolhido": 0, "observacao": "",
--   "ponto_pago_na_hora": false,
--   "maquinas": [{ "maquina_id": uuid, "entrada_atual": 0, "saida_atual": 0,
--                  "contador_zerado": false, "foto_caminho": null }],
--   "despesas": [{ "descricao": "", "valor": 0, "categoria": "outros" }] }
-- =====================================================================
create function salvar_leitura(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_id        uuid := (p->>'id')::uuid;
  v_ponto     pontos%rowtype;
  v_maq       maquinas%rowtype;
  v_item      jsonb;
  v_ent       numeric;  v_sai numeric;
  v_ent_per   numeric;  v_sai_per numeric;
  v_zerado    boolean;
  v_quando    timestamptz;
  v_recolhido numeric := nullif(p->>'valor_recolhido', '')::numeric;
begin
  if coalesce(papel_atual() in ('admin', 'operador'), false) is not true then
    raise exception 'Sem permissão para registrar leitura.';
  end if;

  -- Mesma leitura enviada duas vezes (sincronização offline): não duplica
  if exists (select 1 from leituras where id = v_id) then
    return v_id;
  end if;

  select * into v_ponto from pontos where id = (p->>'ponto_id')::uuid;
  if not found or not tem_acesso_ponto(v_ponto.id) then
    raise exception 'Ponto não encontrado ou sem acesso.';
  end if;
  if jsonb_array_length(coalesce(p->'maquinas', '[]'::jsonb)) = 0 then
    raise exception 'Informe a leitura de pelo menos uma máquina.';
  end if;

  -- Data da leitura vem do celular (pode ter sido feita offline), nunca no futuro
  v_quando := least(coalesce((p->>'data_hora')::timestamptz, now()), now());

  insert into leituras (id, ponto_id, data_hora, data_local, operador_id, operador_nome,
                        percentual_ponto, regra_despesa, valor_recolhido, observacao, ponto_pago_na_hora)
  values (v_id, v_ponto.id, v_quando, (v_quando at time zone 'America/Sao_Paulo')::date, v_uid,
          (select nome from perfis where id = v_uid),
          v_ponto.percentual_ponto, v_ponto.regra_despesa, v_recolhido, coalesce(p->>'observacao', ''),
          coalesce((p->>'ponto_pago_na_hora')::boolean, false));

  for v_item in select * from jsonb_array_elements(p->'maquinas') loop
    select * into v_maq from maquinas
     where id = (v_item->>'maquina_id')::uuid and ponto_id = v_ponto.id and ativa
       for update;
    if not found then
      raise exception 'Máquina não pertence a este ponto ou está inativa.';
    end if;

    v_ent    := (v_item->>'entrada_atual')::numeric;
    v_sai    := (v_item->>'saida_atual')::numeric;
    v_zerado := coalesce((v_item->>'contador_zerado')::boolean, false);

    if (v_ent < v_maq.entrada_atual or v_sai < v_maq.saida_atual) and not v_zerado then
      raise exception 'Máquina %: leitura atual menor que a anterior. Corrija ou marque "contador zerado".', v_maq.codigo;
    end if;

    -- Contador zerado: o que foi lido agora já é o movimento do período
    v_ent_per := case when v_ent < v_maq.entrada_atual then v_ent else v_ent - v_maq.entrada_atual end;
    v_sai_per := case when v_sai < v_maq.saida_atual   then v_sai else v_sai - v_maq.saida_atual   end;

    insert into leitura_maquinas (leitura_id, maquina_id, entrada_anterior, saida_anterior,
                                  entrada_atual, saida_atual, contador_zerado,
                                  entrada_periodo, saida_periodo, resultado, foto_caminho)
    values (v_id, v_maq.id, v_maq.entrada_atual, v_maq.saida_atual, v_ent, v_sai, v_zerado,
            v_ent_per, v_sai_per, v_ent_per - v_sai_per, v_item->>'foto_caminho');

    update maquinas set entrada_atual = v_ent, saida_atual = v_sai where id = v_maq.id;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p->'despesas', '[]'::jsonb)) loop
    insert into despesas (leitura_id, descricao, valor, categoria)
    values (v_id, v_item->>'descricao', (v_item->>'valor')::numeric,
            coalesce(v_item->>'categoria', 'outros')::categoria_despesa);
  end loop;

  perform recalcular_leitura(v_id);
  return v_id;
end $$;

-- =====================================================================
-- Editar leitura já salva (somente Admin), guardando o antes e o depois.
-- JSON aceita (tudo opcional): valor_recolhido, observacao, ponto_pago_na_hora,
--   maquinas: [{ maquina_id, entrada_atual, saida_atual, contador_zerado }],
--   despesas: [{ descricao, valor, categoria }]  (substitui a lista inteira)
-- =====================================================================
create function editar_leitura(p_id uuid, p jsonb, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_antes   jsonb;
  v_item    jsonb;
  v_lm      leitura_maquinas%rowtype;
  v_quando  timestamptz;
  v_ent     numeric;  v_sai numeric;
  v_zerado  boolean;
begin
  if not eh_admin() then
    raise exception 'Somente o Admin pode editar uma leitura salva.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da alteração.';
  end if;
  select data_hora into v_quando from leituras where id = p_id for update;
  if not found then
    raise exception 'Leitura não encontrada.';
  end if;
  v_antes := leitura_json(p_id);

  for v_item in select * from jsonb_array_elements(coalesce(p->'maquinas', '[]'::jsonb)) loop
    select * into v_lm from leitura_maquinas
     where leitura_id = p_id and maquina_id = (v_item->>'maquina_id')::uuid for update;
    if not found then
      raise exception 'Máquina não faz parte desta leitura.';
    end if;
    v_ent    := (v_item->>'entrada_atual')::numeric;
    v_sai    := (v_item->>'saida_atual')::numeric;
    v_zerado := coalesce((v_item->>'contador_zerado')::boolean, v_lm.contador_zerado);
    if (v_ent < v_lm.entrada_anterior or v_sai < v_lm.saida_anterior) and not v_zerado then
      raise exception 'Leitura atual menor que a anterior. Corrija ou marque "contador zerado".';
    end if;

    update leitura_maquinas set
      entrada_atual = v_ent, saida_atual = v_sai, contador_zerado = v_zerado,
      entrada_periodo = case when v_ent < entrada_anterior then v_ent else v_ent - entrada_anterior end,
      saida_periodo   = case when v_sai < saida_anterior   then v_sai else v_sai - saida_anterior   end
    where id = v_lm.id;
    update leitura_maquinas set resultado = entrada_periodo - saida_periodo where id = v_lm.id;

    -- Se esta é a leitura mais recente da máquina, ela passa a ser a base da próxima
    if not exists (select 1 from leitura_maquinas m join leituras l on l.id = m.leitura_id
                    where m.maquina_id = v_lm.maquina_id and l.data_hora > v_quando) then
      update maquinas set entrada_atual = v_ent, saida_atual = v_sai where id = v_lm.maquina_id;
    end if;
  end loop;

  if p ? 'despesas' then
    delete from despesas where leitura_id = p_id;
    insert into despesas (leitura_id, descricao, valor, categoria)
    select p_id, d->>'descricao', (d->>'valor')::numeric, coalesce(d->>'categoria', 'outros')::categoria_despesa
      from jsonb_array_elements(p->'despesas') d;
  end if;

  update leituras set
    valor_recolhido    = case when p ? 'valor_recolhido' then nullif(p->>'valor_recolhido', '')::numeric else valor_recolhido end,
    observacao         = coalesce(p->>'observacao', observacao),
    ponto_pago_na_hora = coalesce((p->>'ponto_pago_na_hora')::boolean, ponto_pago_na_hora)
  where id = p_id;

  perform recalcular_leitura(p_id);

  insert into leitura_alteracoes (leitura_id, alterado_por, motivo, dados_antes, dados_depois)
  values (p_id, auth.uid(), trim(p_motivo), v_antes, leitura_json(p_id));
end $$;

-- =====================================================================
-- "Conferido" — única ação que o dono do ponto consegue fazer
-- =====================================================================
create function conferir_leitura(p_leitura uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_quando timestamptz;
begin
  if coalesce(papel_atual() = 'dono', false) is not true then
    raise exception 'Somente o dono do ponto pode conferir.';
  end if;
  update leituras
     set conferido_em = coalesce(conferido_em, now()),
         conferido_por = coalesce(conferido_por, auth.uid())
   where id = p_leitura and tem_acesso_ponto(ponto_id)
  returning conferido_em into v_quando;
  if v_quando is null then
    raise exception 'Leitura não encontrada.';
  end if;
  return v_quando;
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table perfis                enable row level security;
alter table pontos                enable row level security;
alter table usuario_pontos        enable row level security;
alter table maquinas              enable row level security;
alter table maquina_movimentacoes enable row level security;
alter table leituras              enable row level security;
alter table leitura_maquinas      enable row level security;
alter table despesas              enable row level security;
alter table leitura_alteracoes    enable row level security;
alter table configuracoes         enable row level security;

-- Admin: acesso total em todas as tabelas
create policy admin_tudo on perfis                for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on pontos                for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on usuario_pontos        for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on maquinas              for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on maquina_movimentacoes for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on leituras              for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on leitura_maquinas      for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on despesas              for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on leitura_alteracoes    for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on configuracoes         for all to authenticated using (eh_admin()) with check (eh_admin());

-- Operador e dono: SOMENTE LEITURA, e só do que é dos pontos deles
create policy ver_proprio_perfil on perfis for select to authenticated
  using (id = auth.uid());
create policy ver_meus_vinculos on usuario_pontos for select to authenticated
  using (usuario_id = auth.uid());
create policy ver_meus_pontos on pontos for select to authenticated
  using (tem_acesso_ponto(id));
create policy ver_maquinas_dos_meus_pontos on maquinas for select to authenticated
  using (tem_acesso_ponto(ponto_id));
create policy ver_leituras_dos_meus_pontos on leituras for select to authenticated
  using (tem_acesso_ponto(ponto_id));
create policy ver_itens_das_minhas_leituras on leitura_maquinas for select to authenticated
  using (exists (select 1 from leituras l where l.id = leitura_id and tem_acesso_ponto(l.ponto_id)));
create policy ver_despesas_das_minhas_leituras on despesas for select to authenticated
  using (exists (select 1 from leituras l where l.id = leitura_id and tem_acesso_ponto(l.ponto_id)));

-- Quem não está logado não acessa nada
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function papel_atual(), eh_admin(), tem_acesso_ponto(uuid),
  calcular_divisao(numeric, numeric, numeric, regra_despesa),
  salvar_leitura(jsonb), editar_leitura(uuid, jsonb, text), conferir_leitura(uuid) to authenticated;
