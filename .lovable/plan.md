

# Novo módulo: Afiliados

Criar um perfil de usuário "Afiliado" — pessoas que trabalham captando cadastros para nós. Cada afiliado tem login próprio, cadastra contatos no celular e/ou compartilha um link público para que terceiros se cadastrem sozinhos. Todos os cadastros (manuais ou via link) ficam vinculados ao afiliado dono.

Toda a arquitetura espelha o módulo "Fernanda" já existente — sem tocar nas tabelas/telas atuais, garantindo zero risco de regressão.

## O que o usuário verá

### 1. Painel admin (apenas super_admin / coordenador)
- Nova aba "Afiliados" (ao lado de "Fernanda") com:
  - Lista de todos os afiliados cadastrados
  - Total de cadastros captados por cada um
  - Filtro Hoje/Ontem/7d/30d/Todos/intervalo (mesmo padrão da Fernanda)
  - Visualizar todos os cadastros (com nome do afiliado dono)
  - Exportar Excel

### 2. Criação de Afiliado (aba "Criar Usuários" do admin)
- Novo botão "Afiliado" no seletor de tipo
- Admin define nome + senha + cidade
- Após criar, o admin pode copiar o **link público** daquele afiliado (`/cadastro/<token>`)

### 3. Tela do Afiliado (após login)
- Tela exclusiva (igual à da Fernanda — sem acesso a outros módulos)
- Header: "Afiliados — Olá, <nome>"
- Botão "Copiar meu link público" (compartilhar via WhatsApp)
- Lista dos cadastros que ele captou (manuais + via link)
- Botão "+ Novo cadastro" → formulário com: Nome, Telefone, Data de nascimento, CEP, Rede social
- Filtros e calendário idênticos ao módulo Fernanda

### 4. Tela pública via link (sem login)
- URL: `/cadastro/<token-do-afiliado>`
- Header com nome do afiliado: "Cadastro indicado por <Nome>"
- Formulário: Nome, Telefone, Data de nascimento, CEP, Rede social
- Ao salvar: toast "✅ Cadastro realizado com sucesso!" → redireciona para o **Instagram da Doutora** (`https://instagram.com/...`)
- Cadastro fica vinculado ao afiliado dono do token

## Como funciona por trás (técnico)

### Banco de dados (nova migration)
```sql
-- 1. Adicionar 'afiliado' ao enum tipo_usuario
ALTER TYPE tipo_usuario ADD VALUE IF NOT EXISTS 'afiliado';

-- 2. Token público em hierarquia_usuarios (apenas para afiliados)
ALTER TABLE hierarquia_usuarios
  ADD COLUMN IF NOT EXISTS link_token text UNIQUE;

-- 3. Tabela de cadastros dos afiliados
CREATE TABLE cadastros_afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL,        -- dono (hierarquia_usuarios.id)
  nome text NOT NULL,
  telefone text NOT NULL,
  data_nascimento date,
  cep text,
  rede_social text,
  origem text NOT NULL DEFAULT 'manual',  -- 'manual' | 'link_publico'
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cad_afil_afiliado ON cadastros_afiliados(afiliado_id);
CREATE INDEX ix_cad_afil_criado ON cadastros_afiliados(criado_em DESC);

-- 4. RLS
ALTER TABLE cadastros_afiliados ENABLE ROW LEVEL SECURITY;
-- Afiliado vê só os dele; admin vê tudo
CREATE POLICY "Afiliado e admin selecionam" ON cadastros_afiliados FOR SELECT
  USING (eh_admin_hierarquia() OR afiliado_id = get_meu_usuario_id());
CREATE POLICY "Afiliado e admin inserem" ON cadastros_afiliados FOR INSERT
  WITH CHECK (eh_admin_hierarquia() OR afiliado_id = get_meu_usuario_id());
CREATE POLICY "Afiliado e admin atualizam" ON cadastros_afiliados FOR UPDATE
  USING (eh_admin_hierarquia() OR afiliado_id = get_meu_usuario_id());
CREATE POLICY "Admin deleta" ON cadastros_afiliados FOR DELETE
  USING (eh_admin_hierarquia());
```

### Edge function pública `cadastro-afiliado-publico`
- Recebe `{ token, nome, telefone, data_nascimento?, cep?, rede_social? }`
- Valida token → busca `afiliado_id` em `hierarquia_usuarios`
- Insere em `cadastros_afiliados` com `origem='link_publico'` (usando service role, sem auth)
- Retorna `{ ok: true, instagram_url }`

### Frontend
- `src/contexts/AuthContext.tsx` → adicionar `'afiliado'` no `TipoUsuario` e flag `isAfiliado`
- `src/App.tsx` → nova rota privada `/afiliado` (redireciona afiliados pra cá automaticamente, igual `/fernanda`); nova rota pública `/cadastro/:token`
- `src/pages/HomeAfiliado.tsx` (novo) — clone enxuto de `HomeFernanda.tsx`
- `src/components/TabCadastrosAfiliado.tsx` (novo) — clone de `TabCadastrosFernanda.tsx` com os campos pedidos + botão "Copiar link"
- `src/pages/CadastroPublicoAfiliado.tsx` (novo) — formulário público + redirect Instagram
- `src/components/TabCriarUsuarios.tsx` → adicionar opção "Afiliado" no `TipoAcesso` e gerar token automaticamente
- `src/components/AdminCadastrosAfiliados.tsx` (novo) — visão admin agregada
- `src/pages/AdminDashboard.tsx` → adicionar `'afiliados'` em `VistaAtiva` e botão na navegação

### Configurações
- URL do Instagram da Doutora ficará configurável em `configuracoes` (chave `instagram_doutora_url`) — admin pode editar depois sem código

## Validações de segurança
- RLS garante isolamento total: afiliado só vê os próprios cadastros
- Edge function pública só insere (nunca lê), com rate limit por IP
- Token é único e regenerável pelo admin

## Garantia de não-regressão
- Nenhuma tabela existente alterada (só `hierarquia_usuarios.link_token` que é coluna nova nullable)
- Nenhum componente existente modificado em comportamento — só adições
- Roteamento de Fernanda permanece intacto

