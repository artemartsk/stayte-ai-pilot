
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResalesProperty {
    Reference: string;
    Price: number;
    Bedrooms: number;
    Bathrooms: number;
    Built: number;
    Terrace: number;
    GardenPlot: number;
    Location: string | { en?: string;[key: string]: string | undefined };
    PropertyType: string | { Type?: string; NameType?: string; en?: string;[key: string]: string | undefined };
    Description: string | { en?: string;[key: string]: string | undefined };
    Pictures: { Picture: { URL: string }[] };
    // Additional fields
    int_floor_space?: number;
    IntFloorSpace?: number;
    levels?: number;
    Levels?: number;
    Floor?: number;
    Community_Fees_Year?: number;
    CommunityFeesYear?: number;
    IBI_Fees_Year?: number;
    IBIFeesYear?: number;
    Basura_Tax_Year?: number;
    BasuraTaxYear?: number;
    GpsX?: number;
    GpsY?: number;
    Latitude?: number;
    Longitude?: number;
    Province?: string;
    Area?: string;
    Commission?: number;
    Year_Built?: number;
    YearBuilt?: number;
    OriginalPrice?: number;
}

const MAX_PAGES_PER_RUN = 50; // Safety limit to avoid function timeout
const PAGE_SIZE = 40; // Max allowed by API

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    const startTime = Date.now();
    const timeoutThreshold = 50000; // 50 seconds safety margin for Supabase 60s limit

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const p1 = Deno.env.get('RESALES_ONLINE_P1')
        const p2 = Deno.env.get('RESALES_ONLINE_P2')
        const proxyUrl = Deno.env.get('PROXY_URL')
        const filterIdsStr = Deno.env.get('RESALES_ONLINE_FILTER_IDS') || '1'

        if (!p1 || !p2 || !proxyUrl) {
            console.error('Missing env vars - P1:', !!p1, 'P2:', !!p2, 'Proxy:', !!proxyUrl)
            throw new Error('Missing required environment variables')
        }

        // Debug logging (remove after testing)
        console.log('Using P1:', p1)
        console.log('Using P2:', p2?.substring(0, 8) + '...')
        console.log('Using Proxy:', proxyUrl?.split('@')[1] || proxyUrl)

        const supabase = createClient(supabaseUrl, serviceKey)

        // Load all features
        // Fetch features for matching
        const { data: featuresData, error: featuresError } = await supabase
            .from('features')
            .select('id, key, nameResale');
        if (featuresError) {
            console.error('Error fetching features:', featuresError);
            return new Response(JSON.stringify({ error: 'Failed to fetch features' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            });
        }

        // Create feature lookup map (lowercased nameResale → feature record)
        const featureMap = new Map<string, { id: string, key: string }>();
        for (const feature of featuresData || []) {
            if (feature.nameResale) {
                featureMap.set(feature.nameResale.toLowerCase().trim(), {
                    id: feature.id,
                    key: feature.key
                });
            }
        }

        // Fetch locations for matching Province/Area
        const { data: locationsData, error: locationsError } = await supabase
            .from('locations')
            .select('id, type, name, nameResale');
        if (locationsError) {
            console.error('Error fetching locations:', locationsError);
            return new Response(JSON.stringify({ error: 'Failed to fetch locations' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            });
        }

        // Create location lookup maps by type
        const locationsByType = new Map<string, Map<string, number>>();
        for (const loc of locationsData || []) {
            if (!loc.nameResale) continue;
            if (!locationsByType.has(loc.type)) {
                locationsByType.set(loc.type, new Map());
            }
            const typeMap = locationsByType.get(loc.type)!;
            typeMap.set(loc.nameResale.toLowerCase().trim(), loc.id);
        }
        console.log(`Loaded ${featureMap.size} features for matching`);
        const filterIds = filterIdsStr.split(',').map(id => id.trim())

        const results = []
        let totalCountAcrossFilters = 0;

        for (const filterId of filterIds) {
            console.log(`Starting sync for filter ${filterId}...`)
            const category = filterId === '2' ? 'rent' : 'sale' // Placeholder logic, adjust as needed

            // Load sync state for this filter
            const { data: syncState } = await supabase
                .from('sync_state')
                .select('*')
                .eq('filter_id', filterId)
                .single();

            // Check if last sync was more than 24 hours ago
            const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
            const lastSyncTime = syncState?.last_sync_at ? new Date(syncState.last_sync_at).getTime() : 0;
            const isStale = lastSyncTime === 0 || lastSyncTime < twentyFourHoursAgo;

            // If we completed all pages and it's been less than 24h, skip this filter
            if (syncState && syncState.last_synced_page >= (syncState.total_pages || 0) && !isStale) {
                const hoursUntilNext = Math.ceil((lastSyncTime + (24 * 60 * 60 * 1000) - Date.now()) / (60 * 60 * 1000));
                console.log(`Filter ${filterId} already synced, next refresh in ~${hoursUntilNext}h`);
                continue; // Skip to next filter
            }

            // Reset if stale (>24h), otherwise resume from last page
            let currentPage = isStale ? 1 : (syncState?.last_synced_page || 0) + 1;
            let totalPages = syncState?.total_pages || 1;
            let filterSyncedCount = 0;

            if (isStale && syncState) {
                console.log(`Last sync was ${Math.round((Date.now() - lastSyncTime) / (60 * 60 * 1000))}h ago, starting fresh from page 1 for filter ${filterId}`);
            } else {
                console.log(`Resuming from page ${currentPage} for filter ${filterId}`);
            }



            do {
                // Check for timeout
                if (Date.now() - startTime > timeoutThreshold) {
                    console.log('Nearing timeout, wrapping up current progress...');
                    break;
                }

                console.log(`Fetching page ${currentPage} of ${totalPages || '?'} for filter ${filterId}...`)

                const apiUrl = `https://webapi.resales-online.com/V6/SearchProperties?p1=${p1}&p2=${p2}&p_agency_filterid=${filterId}&p_pagesize=${PAGE_SIZE}&p_pageno=${currentPage}&p_images=0&p_showdecree218=YES&P_ShowGPSCoords=TRUE&p_featurelist=YES`

                const client = Deno.createHttpClient({
                    proxy: { url: proxyUrl },
                })

                const response = await fetch(apiUrl, { client })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error(`API Error for filter ${filterId} page ${currentPage}:`, errorText)
                    break
                }

                const data = await response.json()
                const queryInfo = data.QueryInfo || {}

                // Debug: log raw data structure on first page
                if (currentPage === 1) {
                    console.log('Raw API response keys:', Object.keys(data))
                    console.log('PropertySearch keys:', data.PropertySearch ? Object.keys(data.PropertySearch) : 'undefined')
                    const firstProp = data.PropertySearch?.Property?.[0] || data.Property?.[0];
                    if (firstProp) {
                        console.log('First property keys:', Object.keys(firstProp))
                        console.log('First property Pictures:', firstProp.Pictures ? JSON.stringify(firstProp.Pictures).substring(0, 500) : 'undefined')
                        console.log('First property MainImage:', firstProp.MainImage || 'undefined')
                        // Debug features - API returns all features in PropertyFeatures field
                        console.log('First property PropertyFeatures:', firstProp.PropertyFeatures ? JSON.stringify(firstProp.PropertyFeatures).substring(0, 1000) : 'undefined')
                        console.log('First property Pool:', firstProp.Pool || 'undefined')
                        console.log('First property Parking:', firstProp.Parking || 'undefined')
                        console.log('First property Garden:', firstProp.Garden || 'undefined')
                    }
                }

                // Try different paths for properties array
                const properties: ResalesProperty[] = data.PropertySearch?.Property || data.Property || []

                if (currentPage === 1) {
                    const totalProperties = parseInt(queryInfo.PropertyCount || '0')
                    totalPages = Math.ceil(totalProperties / PAGE_SIZE)
                    console.log(`Filter ${filterId} has ${totalProperties} total properties (${totalPages} pages)`)
                }

                console.log(`Processing ${properties.length} properties from page ${currentPage}`)

                for (const prop of properties) {
                    // PropertyType can be an object like { Type: "Villa" } or a string
                    const rawType = prop.PropertyType;
                    const apiType = (typeof rawType === 'string' ? rawType : rawType?.Type || rawType?.NameType || String(rawType || '')).toLowerCase();

                    // Map to allowed enum values: APARTMENT, COMPLEX, HOUSE
                    let propertyType: 'APARTMENT' | 'COMPLEX' | 'HOUSE' = 'APARTMENT';

                    if (apiType.includes('villa') || apiType.includes('house') || apiType.includes('chalet') || apiType.includes('bungalow') || apiType.includes('townhouse') || apiType.includes('penthouse') || apiType.includes('plot') || apiType.includes('land') || apiType.includes('finca') || apiType.includes('country')) {
                        propertyType = 'HOUSE';
                    } else if (apiType.includes('complex') || apiType.includes('commercial') || apiType.includes('building') || apiType.includes('hotel')) {
                        propertyType = 'COMPLEX';
                    } else if (!apiType.includes('apartment') && !apiType.includes('flat') && !apiType.includes('studio')) {
                        // Log unknown types for debugging
                        console.log('Unknown property type, defaulting to APARTMENT:', apiType);
                    }
                    // Default: APARTMENT (covers apartments, studios, flats, etc.)

                    // Debug Pictures structure on first property
                    if (currentPage === 1 && properties.indexOf(prop) === 0) {
                        console.log('Pictures structure:', prop.Pictures ? JSON.stringify(prop.Pictures).substring(0, 500) : 'undefined')
                    }

                    // Handle various Pictures structures
                    let pictures: string[] = [];
                    const pics = prop.Pictures;
                    if (pics) {
                        if (Array.isArray(pics.Picture)) {
                            // Multiple pictures as array
                            pictures = pics.Picture.map((p: any) => p.URL || p.PictureURL || p.url || '').filter(Boolean);
                        } else if (pics.Picture && typeof pics.Picture === 'object') {
                            // Single picture as object
                            const url = pics.Picture.URL || pics.Picture.PictureURL || pics.Picture.url;
                            if (url) pictures = [url];
                        } else if (Array.isArray(pics)) {
                            // Pictures is directly an array
                            pictures = pics.map((p: any) => p.URL || p.PictureURL || p.url || '').filter(Boolean);
                        }
                    }

                    // Add NewImageUrl=1 parameter required by CDN for reliability
                    pictures = pictures.map(url => {
                        let newUrl = url;
                        // Add NewImageUrl=1 parameter if not present
                        if (!newUrl.includes('NewImageUrl=')) {
                            newUrl += (newUrl.includes('?') ? '&' : '?') + 'NewImageUrl=1';
                        }
                        return newUrl;
                    });

                    // Helper to extract string from potentially multilingual/complex fields
                    const getString = (val: any): string => {
                        if (typeof val === 'string') return val;
                        if (val && typeof val === 'object') {
                            // PropertyType has Type/NameType structure
                            return val.Type || val.NameType || val.en || val['1'] || Object.values(val)[0] || '';
                        }
                        return String(val || '');
                    };

                    const location = getString(prop.Location);
                    const description = getString(prop.Description);
                    const typeDisplay = getString(prop.PropertyType);

                    // Match location: try Area first, then Municipality, then Province
                    let locationId: number | null = null;
                    const apiProvince = prop.Province;
                    const apiArea = prop.Area;

                    // Try to match Area (most specific)
                    if (apiArea) {
                        const areaKey = apiArea.toLowerCase().trim();
                        locationId = locationsByType.get('area')?.get(areaKey) ||
                            locationsByType.get('neighbourhood')?.get(areaKey) ||
                            locationsByType.get('municipality')?.get(areaKey) ||
                            null;
                    }

                    // If Area not found, try Province
                    if (!locationId && apiProvince) {
                        const provinceKey = apiProvince.toLowerCase().trim();
                        locationId = locationsByType.get('province')?.get(provinceKey) || null;
                    }

                    const propertyData = {
                        resale_ref: prop.Reference,
                        price: parseFloat(String(prop.Price)) || 0,
                        bedrooms: parseInt(String(prop.Bedrooms)) || 0,
                        bathrooms: parseInt(String(prop.Bathrooms)) || 0,
                        built_size: parseFloat(String(prop.Built)) || 0,
                        terrace_size: parseFloat(String(prop.Terrace)) || 0,
                        garden_plot_size: parseFloat(String(prop.GardenPlot)) || 0,
                        living_size: parseFloat(String(prop.int_floor_space || prop.IntFloorSpace || 0)) || null,
                        floor: parseInt(String(prop.levels || prop.Levels || prop.Floor || 0)) || null,
                        community_fees: parseFloat(String(prop.Community_Fees_Year || prop.CommunityFeesYear || 0)) || null,
                        ibi_fees: parseFloat(String(prop.IBI_Fees_Year || prop.IBIFeesYear || 0)) || null,
                        garbage_tax: parseFloat(String(prop.Basura_Tax_Year || prop.BasuraTaxYear || 0)) || null,
                        latitude: parseFloat(String(prop.GpsY || prop.Latitude || 0)) || null,
                        longitude: parseFloat(String(prop.GpsX || prop.Longitude || 0)) || null,
                        location_id: locationId,
                        commission: parseFloat(String(prop.Commission || 0)) || null,
                        year_built: parseInt(String(prop.Year_Built || prop.YearBuilt || 0)) || null,
                        original_price: parseFloat(String(prop.OriginalPrice || 0)) || null,
                        address: location,
                        name: `${typeDisplay} in ${location}`,
                        content: description,
                        pictures: pictures,
                        listing_category: category,
                        status: 'ONLINE',
                        type: propertyType,
                        updated_at: new Date().toISOString(),
                    }

                    const { error: upsertError } = await supabase
                        .from('properties')
                        .upsert(propertyData, { onConflict: 'resale_ref' })

                    if (upsertError) {
                        console.error(`Error upserting property ${prop.Reference}:`, upsertError)
                    } else {
                        results.push(prop.Reference)

                        // Sync features for this property
                        // First, get the property ID
                        const { data: propRecord } = await supabase
                            .from('properties')
                            .select('id')
                            .eq('resale_ref', prop.Reference)
                            .single();

                        if (propRecord) {
                            // Delete existing property_features
                            await supabase
                                .from('property_features')
                                .delete()
                                .eq('property_id', propRecord.id);

                            // Parse features from API response - PropertyFeatures.Category structure
                            const featureEntries: { property_id: string, feature_id: string, kind: string }[] = [];

                            // Map API Type to property_feature_kind
                            const typeToKind: Record<string, string> = {
                                'Setting': 'LOCATION_TYPE',
                                'Orientation': 'FEATURE',
                                'Condition': 'FEATURE',
                                'ClimateControl': 'CLIMATE_CONTROL',
                                'Climate Control': 'CLIMATE_CONTROL',
                                'Views': 'VIEW',
                                'Features': 'FEATURE',
                                'Furniture': 'FURNITURE',
                                'Kitchen': 'KITCHEN',
                                'Security': 'SECURITY',
                                'Parking': 'PARKING',
                                'Pool': 'POOL',
                                'Utilities': 'FEATURE',
                                'Category': 'FEATURE',
                            };

                            // PropertyFeatures.Category is an array of {Type, Value} objects
                            const propFeatures = (prop as any).PropertyFeatures;
                            const categories = propFeatures?.Category || [];

                            for (const cat of categories) {
                                const catType = cat.Type || '';
                                const kind = typeToKind[catType] || 'FEATURE';
                                const values = Array.isArray(cat.Value) ? cat.Value : [];

                                for (const val of values) {
                                    if (!val) continue;
                                    const lookupKey = String(val).toLowerCase().trim();
                                    const matched = featureMap.get(lookupKey);

                                    if (!matched) {
                                        // Auto-create missing feature
                                        console.log(`Auto-creating feature: [${catType}] "${val}"`);

                                        const keyPrefix = catType === 'Orientation' ? 'orientation_' :
                                            catType === 'Condition' ? 'condition_' :
                                                catType === 'Parking' ? 'parking_' :
                                                    catType === 'Pool' ? 'pool_' :
                                                        catType === 'Views' ? 'view_' :
                                                            catType === 'Setting' ? 'setting_' :
                                                                catType === 'Category' ? 'category_' :
                                                                    catType === 'Utilities' ? 'utilities_' :
                                                                        'feature_';

                                        const generatedKey = keyPrefix + String(val).toLowerCase()
                                            .replace(/[^a-z0-9]+/g, '_')
                                            .replace(/^_|_$/g, '');

                                        const { data: newFeature, error: insertError } = await supabase
                                            .from('features')
                                            .insert({
                                                key: generatedKey,
                                                name: String(val),
                                                nameResale: String(val),
                                                propertyType: null
                                            })
                                            .select('id, key')
                                            .single();

                                        if (!insertError && newFeature) {
                                            const newRecord = { id: newFeature.id, key: newFeature.key };
                                            featureMap.set(lookupKey, newRecord);

                                            featureEntries.push({
                                                property_id: propRecord.id,
                                                feature_id: newFeature.id,
                                                kind: kind
                                            });
                                        } else {
                                            console.error(`Failed to create feature "${val}":`, insertError);
                                        }
                                    } else {
                                        featureEntries.push({
                                            property_id: propRecord.id,
                                            feature_id: matched.id,
                                            kind: kind
                                        });
                                    }
                                }
                            }

                            // Insert matched features
                            if (featureEntries.length > 0) {
                                const { error: featErr } = await supabase
                                    .from('property_features')
                                    .insert(featureEntries);
                                if (featErr) {
                                    console.error(`Error inserting features for ${prop.Reference}:`, featErr);
                                }
                            }
                        }
                    }
                }

                filterSyncedCount += properties.length;

                // Update sync state after processing this page
                await supabase
                    .from('sync_state')
                    .upsert({
                        filter_id: filterId,
                        last_synced_page: currentPage,
                        total_pages: totalPages,
                        properties_count: totalCountAcrossFilters + filterSyncedCount,
                        last_sync_at: new Date().toISOString()
                    }, { onConflict: 'filter_id' });

                currentPage++;

                if (currentPage > MAX_PAGES_PER_RUN) {
                    console.log(`Reached max pages per run (${MAX_PAGES_PER_RUN}) for filter ${filterId}`)
                    break;
                }

            } while (currentPage <= totalPages);

            totalCountAcrossFilters += filterSyncedCount;


            if (Date.now() - startTime > timeoutThreshold) break;
        }

        return new Response(JSON.stringify({
            success: true,
            total_processed: results.length,
            timed_out: Date.now() - startTime > timeoutThreshold,
            references: results.slice(0, 10) // Only return first 10 refs to keep response small
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error('Sync error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
