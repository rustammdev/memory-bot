-- Remove surrounding quotes from existing tags
UPDATE videos
SET tags = (
  SELECT ARRAY_AGG(TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM tag)))
  FROM UNNEST(tags) AS tag
)
WHERE tags != '{}';
