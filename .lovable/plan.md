## Fase 1 — Limpeza (remover features) ✅
- Remover aba de Rastreamento e componente TrackingMap
- Remover recebimento de cadastros externos
- Remover serviço locationTracker e offlineSync relacionado a rastreamento
- Limpar imports e referências no código

## Fase 2 — Ajustar permissões e roles ✅
- **Admin Master**: mantém tudo como está (painel, criar eventos, gerenciar usuários)
- **Suplente/Liderança**: cadastra vinculado automaticamente a si mesmo (via resolverLigacaoPolitica)
- **Coordenador**: campo editável com busca de suplentes/lideranças
- Lógica implementada em CampoLigacaoPolitica + resolverLigacaoPolitica

## Fase 3 — Sistema de Eventos ✅ (código pronto, migração pendente)
- **EventoContext** com persistência localStorage
- **SeletorEvento** no header (Home + AdminDashboard)
- **GerenciarEventos** (CRUD) na aba Eventos do AdminDashboard
- evento_id injetado automaticamente nos formulários (TabCadastrar, TabFiscais, TabEleitores)
- ⚠️ **MIGRAÇÃO SQL PENDENTE** — executar no SQL Editor do Supabase

## Fase 4 — Reorganizar painéis ✅
- Dashboard com Ranking, Usuários, Registros, Eventos, Localização, Cidades
- Filtros por período e tipo de usuário
