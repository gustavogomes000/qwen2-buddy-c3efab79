-- Fix records created by users who have a suplente_id but the records don't have it set
UPDATE liderancas l
SET suplente_id = h.suplente_id
FROM hierarquia_usuarios h
WHERE l.cadastrado_por = h.id
  AND l.suplente_id IS NULL
  AND h.suplente_id IS NOT NULL;

UPDATE fiscais f
SET suplente_id = h.suplente_id
FROM hierarquia_usuarios h
WHERE f.cadastrado_por = h.id
  AND f.suplente_id IS NULL
  AND h.suplente_id IS NOT NULL;

UPDATE possiveis_eleitores pe
SET suplente_id = h.suplente_id
FROM hierarquia_usuarios h
WHERE pe.cadastrado_por = h.id
  AND pe.suplente_id IS NULL
  AND h.suplente_id IS NOT NULL;

-- Also fix null municipio_id using suplente_municipio
UPDATE liderancas l
SET municipio_id = sm.municipio_id
FROM hierarquia_usuarios h
JOIN suplente_municipio sm ON sm.suplente_id = h.suplente_id::text
WHERE l.cadastrado_por = h.id
  AND l.municipio_id IS NULL
  AND h.suplente_id IS NOT NULL;

UPDATE fiscais f
SET municipio_id = sm.municipio_id
FROM hierarquia_usuarios h
JOIN suplente_municipio sm ON sm.suplente_id = h.suplente_id::text
WHERE f.cadastrado_por = h.id
  AND f.municipio_id IS NULL
  AND h.suplente_id IS NOT NULL;

UPDATE possiveis_eleitores pe
SET municipio_id = sm.municipio_id
FROM hierarquia_usuarios h
JOIN suplente_municipio sm ON sm.suplente_id = h.suplente_id::text
WHERE pe.cadastrado_por = h.id
  AND pe.municipio_id IS NULL
  AND h.suplente_id IS NOT NULL;
