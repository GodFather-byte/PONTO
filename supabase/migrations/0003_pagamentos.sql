-- =====================================================================
-- VERSÃO 2 — Pagamentos aos pontos
-- Para cada leitura: a parte do dono foi paga? Quando, como (Pix/dinheiro)
-- e com qual comprovante. Rodar depois do 0001 e 0002.
-- =====================================================================
create type forma_pagamento as enum ('pix', 'dinheiro');

alter table leituras
  add column pago_em           date,              -- nulo = ainda não pago
  add column pago_forma        forma_pagamento,
  add column pago_comprovante  text,              -- foto no bucket "contadores"
  add column pago_por          uuid references perfis(id),
  add column pago_registrado_em timestamptz;

create index on leituras (ponto_id) where pago_em is null;

-- Leitura marcada "já paguei a parte do ponto agora" nasce paga (em dinheiro, no dia da leitura).
-- Se o Admin desmarcar isso numa edição, o pagamento automático é desfeito.
create function leitura_pagamento_na_hora() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ponto_pago_na_hora and new.pago_em is null then
    new.pago_em := new.data_local;
    new.pago_forma := 'dinheiro';
    new.pago_por := new.operador_id;
    new.pago_registrado_em := now();
  elsif tg_op = 'UPDATE' and old.ponto_pago_na_hora and not new.ponto_pago_na_hora
        and new.pago_comprovante is null then
    new.pago_em := null; new.pago_forma := null; new.pago_por := null; new.pago_registrado_em := null;
  end if;
  return new;
end $$;

create trigger leitura_pagamento_biu before insert or update on leituras
  for each row execute function leitura_pagamento_na_hora();

-- Leituras que já estavam marcadas como pagas na hora
update leituras set pago_em = data_local where ponto_pago_na_hora and pago_em is null;

-- Registrar o pagamento da parte do ponto (Admin ou operador do ponto)
create function registrar_pagamento(p_leitura uuid, p_data date, p_forma forma_pagamento, p_comprovante text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_l leituras%rowtype;
begin
  if coalesce(papel_atual() in ('admin', 'operador'), false) is not true then
    raise exception 'Sem permissão para registrar pagamento.';
  end if;
  select * into v_l from leituras where id = p_leitura for update;
  if not found or not tem_acesso_ponto(v_l.ponto_id) then
    raise exception 'Leitura não encontrada ou sem acesso.';
  end if;
  if v_l.pago_em is not null then
    raise exception 'O pagamento desta leitura já foi registrado.';
  end if;
  if p_data is null or p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data do pagamento inválida.';
  end if;
  update leituras set pago_em = p_data, pago_forma = p_forma, pago_comprovante = p_comprovante,
                      pago_por = auth.uid(), pago_registrado_em = now()
   where id = p_leitura;
end $$;

-- Desfazer um pagamento registrado por engano (somente Admin)
create function desfazer_pagamento(p_leitura uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_admin() then
    raise exception 'Somente o Admin pode desfazer um pagamento.';
  end if;
  if exists (select 1 from leituras where id = p_leitura and ponto_pago_na_hora) then
    raise exception 'Esta leitura foi marcada como paga na hora. Para mudar isso, use "Editar leitura".';
  end if;
  update leituras set pago_em = null, pago_forma = null, pago_comprovante = null,
                      pago_por = null, pago_registrado_em = null
   where id = p_leitura;
end $$;

revoke execute on function leitura_pagamento_na_hora(), registrar_pagamento(uuid, date, forma_pagamento, text),
  desfazer_pagamento(uuid) from public, anon, authenticated;
grant execute on function registrar_pagamento(uuid, date, forma_pagamento, text), desfazer_pagamento(uuid) to authenticated;
