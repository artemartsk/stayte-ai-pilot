-- Reset and recreate the ai_workflow_templates table
-- Since the table is empty and we are switching to a graph-based structure, 
-- we start fresh to ensure a clean schema.

DROP TABLE IF EXISTS public.ai_workflow_templates;

CREATE TABLE public.ai_workflow_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb, -- Stores the graph object
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT ai_workflow_templates_pkey PRIMARY KEY (id),
  CONSTRAINT ai_workflow_templates_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies (id) ON DELETE CASCADE,
  -- Data Integrity: Ensure the JSON structure is always a valid graph
  CONSTRAINT valid_graph_structure CHECK (
    jsonb_typeof(steps -> 'nodes') = 'array' AND
    jsonb_typeof(steps -> 'edges') = 'array'
  )
) TABLESPACE pg_default;

-- Performance: GIN Index allows querying inside the JSON (e.g., "Find all workflows sending WhatsApp")
CREATE INDEX idx_ai_workflow_templates_steps ON public.ai_workflow_templates USING GIN (steps);

-- Documentation
COMMENT ON COLUMN public.ai_workflow_templates.steps IS 'Stores the workflow graph data. Must contain "nodes" and "edges" arrays. Indexed for fast search.';

