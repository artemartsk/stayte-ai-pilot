-- Migration: Auto-assign contact to matching group based on filter criteria

-- Function to assign contact to matching group
CREATE OR REPLACE FUNCTION public.assign_contact_to_matching_group()
RETURNS TRIGGER AS $$
DECLARE
    v_group_id uuid;
    v_group RECORD;
    v_prefs RECORD;
    v_filter jsonb;
    v_matches boolean;
    v_budget numeric;
    v_bedrooms integer;
    v_locations text[];
    v_property_type text;
BEGIN
    -- Get aggregated preferences from the contact's deals
    SELECT 
        MAX(dpp.budget) as budget,
        MAX(dpp.max_budget) as max_budget,
        MAX(dpp.bedrooms) as bedrooms,
        ARRAY_AGG(DISTINCT COALESCE(dpp.city, dpp.area, dpp.region)) FILTER (WHERE dpp.city IS NOT NULL OR dpp.area IS NOT NULL OR dpp.region IS NOT NULL) as locations,
        CASE 
            WHEN bool_or(dpp.type_villa) THEN 'villa'
            WHEN bool_or(dpp.type_apartment) THEN 'apartment'
            WHEN bool_or(dpp.type_townhouse) THEN 'townhouse'
            WHEN bool_or(dpp.type_land_plot) THEN 'land plot'
            ELSE NULL
        END as property_type
    INTO v_prefs
    FROM deals d
    JOIN deal_preference_profiles dpp ON dpp.deal_id = d.id
    WHERE d.contact_id = NEW.id;

    -- If no preferences found, exit without changing group
    IF v_prefs IS NULL OR (v_prefs.budget IS NULL AND v_prefs.bedrooms IS NULL AND v_prefs.property_type IS NULL) THEN
        RETURN NEW;
    END IF;

    -- Use max_budget if available, otherwise use budget
    v_budget := COALESCE(v_prefs.max_budget, v_prefs.budget);
    v_bedrooms := v_prefs.bedrooms;
    v_locations := v_prefs.locations;
    v_property_type := v_prefs.property_type;

    -- Find the first matching group
    FOR v_group IN 
        SELECT id, filter_criteria
        FROM contact_groups 
        WHERE agency_id = NEW.agency_id 
          AND filter_criteria IS NOT NULL
        ORDER BY name
    LOOP
        v_filter := v_group.filter_criteria;
        v_matches := true;

        -- Check minBudget
        IF v_filter->>'minBudget' IS NOT NULL AND v_budget IS NOT NULL THEN
            IF v_budget < (v_filter->>'minBudget')::numeric THEN
                v_matches := false;
            END IF;
        END IF;

        -- Check maxBudget
        IF v_matches AND v_filter->>'maxBudget' IS NOT NULL AND v_budget IS NOT NULL THEN
            IF v_budget > (v_filter->>'maxBudget')::numeric THEN
                v_matches := false;
            END IF;
        END IF;

        -- Check minBedrooms
        IF v_matches AND v_filter->>'minBedrooms' IS NOT NULL AND v_bedrooms IS NOT NULL THEN
            IF v_bedrooms < (v_filter->>'minBedrooms')::integer THEN
                v_matches := false;
            END IF;
        END IF;

        -- Check propertyType (case-insensitive)
        IF v_matches AND v_filter->>'propertyType' IS NOT NULL AND v_property_type IS NOT NULL THEN
            IF lower(v_property_type) != lower(v_filter->>'propertyType') THEN
                v_matches := false;
            END IF;
        END IF;

        -- Check locations (at least one must match)
        IF v_matches AND v_filter->'locations' IS NOT NULL AND jsonb_array_length(v_filter->'locations') > 0 AND v_locations IS NOT NULL THEN
            v_matches := false;
            FOR i IN 0..jsonb_array_length(v_filter->'locations')-1 LOOP
                IF (v_filter->'locations'->>i) = ANY(v_locations) THEN
                    v_matches := true;
                    EXIT;
                END IF;
            END LOOP;
        END IF;

        -- If all criteria match, assign this group
        IF v_matches THEN
            v_group_id := v_group.id;
            EXIT;
        END IF;
    END LOOP;

    -- Update the contact's group_id (overwrite)
    IF v_group_id IS NOT NULL THEN
        NEW.group_id := v_group_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on contacts table
DROP TRIGGER IF EXISTS trg_auto_assign_group ON public.contacts;
CREATE TRIGGER trg_auto_assign_group
    BEFORE INSERT OR UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_contact_to_matching_group();

-- Comment
COMMENT ON FUNCTION public.assign_contact_to_matching_group() IS 'Automatically assigns a contact to a matching group based on their deal preferences and the group filter criteria.';
