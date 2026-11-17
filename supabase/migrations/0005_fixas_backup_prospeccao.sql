-- =====================================================================
-- VERSÃO 2 — Despesas fixas, backup e prospecção de pontos
-- Rodar depois do 0004.
-- =====================================================================

-- ---------- Despesas fixas (salário, aluguel...) por ponto ----------
-- Regra: cada despesa fixa entra UMA vez por mês, na primeira leitura do ponto feita
-- a partir do dia de vencimento. Se o mês passar sem leitura, ela entra na leitura
-- seguinte (só o mês anterior é recuperado, para não acumular).
create table despesas_fixas (
  id          uuid primary key default gen_random_uuid(),
  ponto_id    uuid not null references pontos(id) on delete cascade,
  descricao   text not null,
  categoria   categoria_despesa not null default 'outros',
  valor       numeric(14,2) not null check (valor > 0),
  dia_do_mes  integer not null check (dia_do_mes between 1 and 31),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index on despesas_fixas (ponto_id);

-- Em qual leitura cada despesa fixa foi lançada em cada mês ("2026-11")
create table despesas_fixas_lancamentos (
  despesa_fixa_id  uuid not null references despesas_fixas(id) on delete cascade,
  competencia      text not null check (competencia ~ '^[0-9]{4}-[0-9]{2}$'),
  leitura_id       uuid not null references leituras(id) on delete cascade,
  primary key (despesa_fixa_id, competencia)
);

alter table despesas_fixas             enable row level security;
alter table despesas_fixas_lancamentos enable row level security;
create policy admin_tudo on despesas_fixas             for all to authenticated using (eh_admin()) with check (eh_admin());
create policy admin_tudo on despesas_fixas_lancamentos for all to authenticated using (eh_admin()) with check (eh_admin());

-- Despesas fixas que devem entrar na próxima leitura (dos pontos que a pessoa acessa)
create function despesas_fixas_pendentes()
returns table (id uuid, ponto_id uuid, descricao text, categoria categoria_despesa, valor numeric, competencia text)
language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
       meses as (
         select date_trunc('month', d)::date as inicio from hoje
         union all
         select (date_trunc('month', d) - interval '1 month')::date from hoje
       )
  select f.id, f.ponto_id, f.descricao, f.categoria, f.valor, to_char(m.inicio, 'YYYY-MM')
    from despesas_fixas f cross join meses m cross join hoje h
   where f.ativa
     and coalesce(papel_atual() in ('admin', 'operador'), false) and tem_acesso_ponto(f.ponto_id)
     -- a despesa já existia naquele mês
     and date_trunc('month', f.criado_em at time zone 'America/Sao_Paulo')::date <= m.inicio
     -- o dia de vencimento já chegou (dia 31 em mês de 30 dias vale no último dia)
     and h.d >= least(m.inicio + (f.dia_do_mes - 1), (m.inicio + interval '1 month - 1 day')::date)
     and not exists (select 1 from despesas_fixas_lancamentos l
                      where l.despesa_fixa_id = f.id and l.competencia = to_char(m.inicio, 'YYYY-MM'))
   order by m.inicio, f.descricao
$$;

-- Lança uma despesa em uma leitura (usada só pela salvar_leitura).
-- Custos de manutenção e despesas fixas usam o valor do cadastro e nunca entram duas vezes.
create function lancar_despesa(p_leitura uuid, p_ponto uuid, p_data date, p_item jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_custo numeric;
  v_fixa  despesas_fixas%rowtype;
  v_comp  text := p_item->>'competencia';
begin
  if p_item->>'manutencao_id' is not null then
    update manutencoes set leitura_id = p_leitura
     where id = (p_item->>'manutencao_id')::uuid and ponto_id = p_ponto
       and destino = 'despesa_do_ponto' and leitura_id is null
    returning custo into v_custo;
    if not found then return; end if;
    insert into despesas (leitura_id, descricao, valor, categoria)
    values (p_leitura, p_item->>'descricao', v_custo, 'manutencao');

  elsif p_item->>'despesa_fixa_id' is not null then
    select * into v_fixa from despesas_fixas where id = (p_item->>'despesa_fixa_id')::uuid and ponto_id = p_ponto;
    if not found then return; end if;
    -- só o mês da leitura ou o anterior
    if v_comp is null or v_comp not in (to_char(p_data, 'YYYY-MM'), to_char(p_data - interval '1 month', 'YYYY-MM')) then
      return;
    end if;
    insert into despesas_fixas_lancamentos (despesa_fixa_id, competencia, leitura_id)
    values (v_fixa.id, v_comp, p_leitura) on conflict do nothing;
    if not found then return; end if;   -- já lançada neste mês
    insert into despesas (leitura_id, descricao, valor, categoria)
    values (p_leitura, coalesce(nullif(p_item->>'descricao', ''), v_fixa.descricao), v_fixa.valor, v_fixa.categoria);

  else
    insert into despesas (leitura_id, descricao, valor, categoria)
    values (p_leitura, p_item->>'descricao', (p_item->>'valor')::numeric,
            coalesce(p_item->>'categoria', 'outros')::categoria_despesa);
  end if;
end $$;

create or replace function salvar_leitura(p jsonb) returns uuid
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
                        percentual_ponto, regra_despesa, valor_recolhido, observacao, ponto_pago_na_hora,
                        assinatura_caminho, assinatura_nome)
  values (v_id, v_ponto.id, v_quando, (v_quando at time zone 'America/Sao_Paulo')::date, v_uid,
          (select nome from perfis where id = v_uid),
          v_ponto.percentual_ponto, v_ponto.regra_despesa, v_recolhido, coalesce(p->>'observacao', ''),
          coalesce((p->>'ponto_pago_na_hora')::boolean, false),
          nullif(p->>'assinatura_caminho', ''), coalesce(p->>'assinatura_nome', ''));

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

  -- Cada despesa passa pela função lancar_despesa (comum, de manutenção ou fixa)
  for v_item in select * from jsonb_array_elements(coalesce(p->'despesas', '[]'::jsonb)) loop
    perform lancar_despesa(v_id, v_ponto.id, (v_quando at time zone 'America/Sao_Paulo')::date, v_item);
  end loop;

  perform recalcular_leitura(v_id);
  return v_id;
end $$;

-- ---------- Backup ----------
-- Fotografia de todos os dados em JSON, guardada no próprio banco (as 8 mais recentes).
-- Protege contra apagar ou alterar algo por engano; para proteção contra perda do banco,
-- o Admin deve baixar o arquivo de tempos em tempos. As fotos (Storage) não entram.
create table backups (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  origem     text not null default 'manual',     -- 'manual' ou 'semanal'
  tamanho    integer not null default 0,         -- em bytes
  dados      jsonb not null
);
alter table backups enable row level security;
create policy admin_tudo on backups for all to authenticated using (eh_admin()) with check (eh_admin());

create function gerar_backup(p_origem text default 'manual') returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_dados jsonb;
  v_id    bigint;
  t       text;
begin
  -- Chamado pelo app: só Admin. Chamado pelo agendamento do banco (sem usuário): liberado.
  if auth.uid() is not null and not eh_admin() then
    raise exception 'Somente o Admin pode gerar backup.';
  end if;
  v_dados := jsonb_build_object('gerado_em', now(), 'versao', 2);
  foreach t in array array['configuracoes', 'perfis', 'pontos', 'usuario_pontos', 'maquinas', 'maquina_movimentacoes',
                           'leituras', 'leitura_maquinas', 'despesas', 'leitura_alteracoes', 'manutencoes',
                           'despesas_fixas', 'despesas_fixas_lancamentos', 'prospectos'] loop
    execute format('select $1 || jsonb_build_object(%L, coalesce((select jsonb_agg(to_jsonb(x)) from %I x), ''[]''::jsonb))', t, t)
      into v_dados using v_dados;
  end loop;
  insert into backups (origem, dados, tamanho) values (p_origem, v_dados, octet_length(v_dados::text)) returning id into v_id;
  -- mantém só os 8 mais recentes
  delete from backups where id not in (select id from backups order by id desc limit 8);
  return v_id;
end $$;

-- ---------- Prospecção de novos pontos (só Admin) ----------
create type status_prospecto as enum ('contato_feito', 'negociando', 'fechado', 'recusado');

create table prospectos (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,
  endereco             text not null default '',
  contato              text not null default '',
  status               status_prospecto not null default 'contato_feito',
  percentual_proposto  numeric(5,2) check (percentual_proposto between 0 and 100),
  observacoes          text not null default '',
  ponto_id             uuid references pontos(id) on delete set null,  -- preenchido quando vira ponto
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
alter table prospectos enable row level security;
create policy admin_tudo on prospectos for all to authenticated using (eh_admin()) with check (eh_admin());

-- "Fechado": cria o ponto com os dados do prospecto e devolve o id do ponto
create function converter_prospecto(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_p     prospectos%rowtype;
  v_ponto uuid;
begin
  if not eh_admin() then
    raise exception 'Somente o Admin pode converter um prospecto em ponto.';
  end if;
  select * into v_p from prospectos where id = p_id for update;
  if not found then raise exception 'Prospecto não encontrado.'; end if;
  if v_p.ponto_id is not null then return v_p.ponto_id; end if;   -- já convertido

  insert into pontos (nome, endereco, telefone, percentual_ponto, observacoes)
  values (v_p.nome, v_p.endereco, regexp_replace(v_p.contato, '[^0-9]', '', 'g'),
          coalesce(v_p.percentual_proposto, 0), v_p.observacoes)
  returning id into v_ponto;
  update prospectos set status = 'fechado', ponto_id = v_ponto, atualizado_em = now() where id = p_id;
  return v_ponto;
end $$;

-- ---------- Rota do dia ----------
-- O operador também precisa saber depois de quantos dias um ponto está "atrasado"
create policy operador_le_configuracoes on configuracoes for select to authenticated
  using (papel_atual() = 'operador');

revoke execute on function despesas_fixas_pendentes(), lancar_despesa(uuid, uuid, date, jsonb),
  gerar_backup(text), converter_prospecto(uuid) from public, anon, authenticated;
grant execute on function despesas_fixas_pendentes(), gerar_backup(text), converter_prospecto(uuid) to authenticated;
