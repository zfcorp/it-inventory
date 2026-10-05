-- Migration: Add issued_to_branch_id to assets
-- Run this in the Supabase SQL Editor

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS issued_to_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_issued_to_branch ON public.assets(issued_to_branch_id);

-- RLS: staff can update this column (already covered by existing asset update policies)
