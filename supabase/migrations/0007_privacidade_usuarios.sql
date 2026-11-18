-- =====================================================================
-- Privacidade entre usuários: um Admin não enxerga os outros Admins.
-- Na tela Usuários cada Admin vê a própria conta e as contas que ele gerencia
-- (operadores e donos de ponto). Promover alguém a Admin deixa de ser feito pelo app.
-- =====================================================================
drop policy admin_tudo on perfis;

-- Admin gerencia só quem NÃO é Admin (a própria conta continua visível pela regra ver_proprio_perfil)
create policy admin_gerencia_nao_admins on perfis for all to authenticated
  using (eh_admin() and papel <> 'admin')
  with check (eh_admin() and papel <> 'admin');

-- O backup também não leva os dados dos outros Admins
create or replace function gerar_backup(p_origem text default 'manual') returns bigint
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
  v_dados := jsonb_build_object('gerado_em', now(), 'versao', 2,
    'perfis', coalesce((select jsonb_agg(to_jsonb(x)) from perfis x where x.papel <> 'admin'), '[]'::jsonb));
  foreach t in array array['configuracoes', 'pontos', 'usuario_pontos', 'maquinas', 'maquina_movimentacoes',
                           'leituras', 'leitura_maquinas', 'despesas', 'leitura_alteracoes', 'manutencoes',
                           'despesas_fixas', 'despesas_fixas_lancamentos', 'prospectos'] loop
    execute format('select $1 || jsonb_build_object(%L, coalesce((select jsonb_agg(to_jsonb(x)) from %I x), ''[]''::jsonb))', t, t)
      into v_dados using v_dados;
  end loop;
  insert into backups (origem, dados, tamanho) values (p_origem, v_dados, octet_length(v_dados::text)) returning id into v_id;
  delete from backups where id not in (select id from backups order by id desc limit 8);
  return v_id;
end $$;
