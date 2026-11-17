# Controle de Máquinas

App web (PWA) para registrar leituras de máquinas em pontos, com divisão de resultado entre empresa e dono do ponto.

## Andamento

- [x] Etapa 1 — Banco e regras de acesso (`supabase/migrations/`)
- [x] Etapa 2 — Cadastros, leitura, cálculos e despesas
- [x] Etapa 3 — Relatório WhatsApp / PDF
- [x] Etapa 4 — Área do dono do ponto + "Conferido"
- [ ] Etapa 5 — Painel do admin + exportação
- [ ] Etapa 6 — Passo a passo de publicação

## Rodar no computador

```bash
npm install
cp .env.example .env      # preencha com a URL e a chave pública do Supabase
npm run dev
```

No Supabase, rode `supabase/migrations/0001_estrutura.sql` e depois `0002_fotos.sql` no SQL Editor.
O primeiro Admin é definido uma vez pelo SQL Editor, depois de criar a conta no app:

```sql
update perfis set papel = 'admin' where email = 'seu@email.com';
```

## Testes

```bash
npm run testar:calculos   # contas da leitura
npm run testar:banco      # banco em memória: cálculos no servidor e regras de acesso
```

## Organização

- `src/lib/calculos.js` — contas (mesma regra da função `calcular_divisao` do banco)
- `src/lib/fila.js` — funcionamento sem internet (cache e fila de envio)
- `src/telas/` — telas; `src/componentes/` — peças reaproveitadas
