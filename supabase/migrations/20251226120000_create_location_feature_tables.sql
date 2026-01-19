-- Create locations reference table
CREATE TABLE IF NOT EXISTS public.locations (
    id INTEGER PRIMARY KEY,
    type TEXT,
    name TEXT NOT NULL,
    name_resale TEXT,
    name_ai TEXT,
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    annual_revenue_increase_pct NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    parent_id INTEGER REFERENCES public.locations(id),
    picture TEXT,
    is_favorite BOOLEAN DEFAULT false
);

-- Create features reference table
CREATE TABLE IF NOT EXISTS public.features (
    key TEXT PRIMARY KEY,
    icon TEXT,
    name TEXT NOT NULL,
    name_resale TEXT,
    name_ai TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    property_type TEXT,
    parent_key TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_name_ai ON public.locations(name_ai);
CREATE INDEX IF NOT EXISTS idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_features_name ON public.features(name);
CREATE INDEX IF NOT EXISTS idx_features_name_ai ON public.features(name_ai);

-- Import will be done separately via psql COPY command or SQL INSERT
