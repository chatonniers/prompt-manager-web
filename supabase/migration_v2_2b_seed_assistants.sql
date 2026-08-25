-- Migration v2.2b: Seed AI Assistants in catalog
-- Run this AFTER migration_v2_2_assistant_industry.sql

UPDATE public.catalog
SET assistants = '[
  {"id":"ast-001","name":"Product Design Assistant","domain":"Autonomous SCM"},
  {"id":"ast-002","name":"Planning Assistant","domain":"Autonomous SCM"},
  {"id":"ast-003","name":"Procurement Assistant","domain":"Autonomous Spend"},
  {"id":"ast-004","name":"Manufacturing Assistant","domain":"Autonomous SCM"},
  {"id":"ast-005","name":"Logistics Assistant","domain":"Autonomous SCM"},
  {"id":"ast-006","name":"Asset and Service Assistant","domain":"Autonomous HCM"}
]'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001';
