## Fase 1 — Limpeza (remover features)
- Remover aba de Rastreamento e componente TrackingMap
- Remover recebimento de cadastros externos (edge functions: receber-cadastro-externo, sincronizar-visitante, listar-usuarios-externos)
- Remover serviço locationTracker e offlineSync relacionado a rastreamento
- Limpar imports e referências no código

## Fase 2 — Ajustar permissões e roles
- **Admin Master**: mantém tudo como está (painel, criar eventos, gerenciar usuários)
- **Suplente/Liderança** (vêm do sistema externo): cadastra lideranças, fiscais e eleitores vinculados automaticamente a si mesmo. Vê seus cadastros. Campo de ligação política auto-preenchido
- **Coordenador**: pode selecionar qual liderança/suplente vincular no cadastro. O campo busca SOMENTE suplentes e lideranças que vieram do sistema externo E que são usuários do sistema (têm conta). Lideranças cadastradas internamente NÃO aparecem nessa busca

## Fase 3 — Criar feature de Eventos
- Nova tabela `eventos` (nome, localização, descrição, criado_por, ativo)
- Admin cria/edita/remove eventos no Painel
- Coordenador vê lista de eventos ativos e seleciona um
- Evento selecionado fica "fixo" — todos os cadastros feitos recebem a tag do evento
- Pode desmarcar o evento a qualquer momento
- Nova coluna `evento_id` nas tabelas de cadastro (lideranças, fiscais, possiveis_eleitores)

## Fase 4 — Reorganizar painéis
- Ajustar painel admin com as novas métricas
- Reorganizar navegação conforme os novos roles
- Ajustar dashboard com filtros por evento

Começo pela **Fase 1** agora.