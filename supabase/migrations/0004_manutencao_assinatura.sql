-- =====================================================================
-- VERSÃO 2 — Manutenção das máquinas e assinatura do responsável
-- Rodar depois do 0003.
-- =====================================================================
create type status_maquina      as enum ('funcionando', 'com_defeito', 'parada');
create type destino_manutencao  as enum ('despesa_do_ponto', 'so_da_empresa');

alter table maquinas add column status status_maquina not null default 'funcionando';

-- Histórico de ocorrências de cada máquina
create table manutencoes (
  id              uuid primary key default gen_random_uuid(),
  maquina_id      uuid not null references maquinas(id) on delete cascade,
  ponto_id        uuid references pontos(id),          -- onde a máquina estava (nulo = estoque)
  data            date not null,
  problema        text not null,
  peca_trocada    text not null default '',
  custo           numeric(14,2) not null default 0 check (custo >= 0),
  quem_fez        text not null default '',
  foto_caminho    text,
  -- Quem paga o custo: entra como despesa na próxima leitura do ponto, ou fica só com a empresa
  destino         destino_manutencao not null default 'so_da_empresa',
  leitura_id      uuid references leituras(id) on delete set null,  -- leitura em que o custo foi lançado
  status_depois   status_maquina not null,
  registrado_por  uuid references perfis(id),
  criado_em       timestamptz not null default now()
);
create index on manutencoes (maquina_id, data desc);
create index on manutencoes (ponto_id) where leitura_id is null;

alter table manutencoes enable row level security;
create policy admin_tudo on manutencoes for all to authenticated using (eh_admin()) with check (eh_admin());
-- Operador vê as ocorrências dos pontos dele. O dono do ponto não vê manutenção.
create policy operador_ve_manutencoes on manutencoes for select to authenticated
  using (papel_atual() = 'operador' and tem_acesso_ponto(ponto_id));

-- Registrar ocorrência e/ou mudar o status da máquina (Admin ou operador do ponto).
-- JSON: { maquina_id, status, data, problema, peca_trocada, custo, quem_fez, foto_caminho, destino }
create function registrar_manutencao(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_maq    maquinas%rowtype;
  v_id     uuid;
  v_custo  numeric := coalesce(nullif(p->>'custo', '')::numeric, 0);
  v_data   date := coalesce(nullif(p->>'data', '')::date, (now() at time zone 'America/Sao_Paulo')::date);
begin
  if coalesce(papel_atual() in ('admin', 'operador'), false) is not true then
    raise exception 'Sem permissão para registrar manutenção.';
  end if;
  select * into v_maq from maquinas where id = (p->>'maquina_id')::uuid for update;
  if not found or not (eh_admin() or tem_acesso_ponto(v_maq.ponto_id)) then
    raise exception 'Máquina não encontrada ou sem acesso.';
  end if;
  if coalesce(trim(p->>'problema'), '') = '' then
    raise exception 'Descreva o problema.';
  end if;
  if v_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data inválida.';
  end if;

  insert into manutencoes (maquina_id, ponto_id, data, problema, peca_trocada, custo, quem_fez, foto_caminho,
                           destino, status_depois, registrado_por)
  values (v_maq.id, v_maq.ponto_id, v_data, trim(p->>'problema'), coalesce(p->>'peca_trocada', ''), v_custo,
          coalesce(p->>'quem_fez', ''), nullif(p->>'foto_caminho', ''),
          -- máquina em estoque não tem ponto para cobrar
          case when v_maq.ponto_id is null then 'so_da_empresa'
               else coalesce(nullif(p->>'destino', ''), 'so_da_empresa')::destino_manutencao end,
          coalesce(nullif(p->>'status', ''), v_maq.status::text)::status_maquina, auth.uid())
  returning id into v_id;

  update maquinas set status = coalesce(nullif(p->>'status', ''), status::text)::status_maquina where id = v_maq.id;
  return v_id;
end $$;

-- Assinatura do responsável do ponto, feita com o dedo na tela ao finalizar a leitura
alter table leituras
  add column assinatura_caminho text,                     -- imagem no bucket "contadores"
  add column assinatura_nome    text not null default '';  -- nome de quem assinou

-- salvar_leitura passa a guardar a assinatura e a lançar custos de manutenção como despesa
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
  v_custo_manut numeric;
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

  for v_item in select * from jsonb_array_elements(coalesce(p->'despesas', '[]'::jsonb)) loop
    -- Despesa que veio de um custo de manutenção: marca o custo como lançado nesta leitura.
    -- Se ele já entrou em outra leitura, a despesa é ignorada (nunca cobra o ponto duas vezes).
    if v_item->>'manutencao_id' is not null then
      update manutencoes set leitura_id = v_id
       where id = (v_item->>'manutencao_id')::uuid and ponto_id = v_ponto.id
         and destino = 'despesa_do_ponto' and leitura_id is null
      returning custo into v_custo_manut;
      continue when not found;
      -- o valor vem do cadastro da manutenção, não do que foi digitado no celular
      insert into despesas (leitura_id, descricao, valor, categoria)
      values (v_id, v_item->>'descricao', v_custo_manut, 'manutencao');
      continue;
    end if;
    insert into despesas (leitura_id, descricao, valor, categoria)
    values (v_id, v_item->>'descricao', (v_item->>'valor')::numeric,
            coalesce(v_item->>'categoria', 'outros')::categoria_despesa);
  end loop;

  perform recalcular_leitura(v_id);
  return v_id;
end $$;

revoke execute on function registrar_manutencao(jsonb) from public, anon, authenticated;
grant execute on function registrar_manutencao(jsonb) to authenticated;
