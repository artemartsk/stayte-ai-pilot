#!/bin/bash

# CSV Import Script for Canonical Locations and Features
# This script imports data from CSV files into Supabase

set -e  # Exit on error

echo "🚀 Importing canonical data into Supabase..."

# Check if CSV files exist
if [ ! -f "locations (1).csv" ]; then
    echo "❌ Error: locations (1).csv not found"
    exit 1
fi

if [ ! -f "features (3).csv" ]; then
    echo "❌ Error: features (3).csv not found"
    exit 1
fi

# Get Supabase connection string
SUPABASE_DB_URL=$(supabase status | grep "DB URL" | awk '{print $3}')

if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: Could not get Supabase DB URL. Make sure Supabase is running (supabase start)"
    exit 1
fi

echo "📊 Importing locations..."
psql "$SUPABASE_DB_URL" -c "\COPY public.locations(id, type, name, name_resale, name_ai, description, latitude, longitude, annual_revenue_increase_pct, created_at, updated_at, parent_id, picture, is_favorite) FROM 'locations (1).csv' DELIMITER ',' CSV HEADER;"

echo "✨ Importing features..."
psql "$SUPABASE_DB_URL" -c "\COPY public.features(key, icon, name, name_resale, name_ai, created_at, updated_at, property_type, parent_key) FROM 'features (3).csv' DELIMITER ',' CSV HEADER;"

# Verify import
LOCATION_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM public.locations;")
FEATURE_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM public.features;")

echo "✅ Import complete!"
echo "   Locations: $LOCATION_COUNT rows"
echo "   Features: $FEATURE_COUNT rows"
