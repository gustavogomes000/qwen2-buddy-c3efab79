-- Tabela de municípios
CREATE TABLE IF NOT EXISTS municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  uf text NOT NULL DEFAULT 'GO',
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);

-- Inserir municípios iniciais
INSERT INTO municipios (nome, uf) VALUES
  ('Aparecida de Goiânia', 'GO'),
  ('Goiânia', 'GO')
ON CONFLICT (nome) DO NOTHING;

-- Tabela de mapeamento: suplente externo → município local
CREATE TABLE IF NOT EXISTS suplente_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suplente_id text NOT NULL UNIQUE,
  municipio_id uuid NOT NULL REFERENCES municipios(id),
  criado_em timestamptz DEFAULT now()
);

-- Adicionar municipio_id nas tabelas de cadastro
ALTER TABLE liderancas ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES municipios(id);
ALTER TABLE fiscais ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES municipios(id);
ALTER TABLE possiveis_eleitores ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES municipios(id);
ALTER TABLE hierarquia_usuarios ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES municipios(id);

-- RLS municipios
ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem municipios"
  ON municipios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin gerencia municipios"
  ON municipios FOR ALL TO authenticated
  USING (eh_super_admin())
  WITH CHECK (eh_super_admin());

-- RLS suplente_municipio
ALTER TABLE suplente_municipio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem suplente_municipio"
  ON suplente_municipio FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admin gerencia suplente_municipio"
  ON suplente_municipio FOR ALL TO authenticated
  USING (eh_super_admin())
  WITH CHECK (eh_super_admin());
