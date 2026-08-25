-- Migration v2.2c: Seed Industries in catalog
-- Run this AFTER migration_v2_2_assistant_industry.sql

UPDATE public.catalog
SET industries = ARRAY[
  'Retail',
  'Banking',
  'Utilities',
  'Chemicals',
  'Automotive',
  'Life Sciences',
  'Public Sector',
  'Professional Services',
  'Industrial Manufacturing',
  'Construction Operations',
  'Travel & Transportation'
]
WHERE id = '00000000-0000-0000-0000-000000000001';
