export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "13.0.5"
    }
    public: {
        Tables: {
            activities: {
                Row: {
                    actor_id: string | null
                    agency_id: string
                    contact_id: string
                    created_at: string | null
                    deal_id: string | null
                    id: string
                    payload: Json | null
                    type: string
                }
                Insert: {
                    actor_id?: string | null
                    agency_id: string
                    contact_id: string
                    created_at?: string | null
                    deal_id?: string | null
                    id?: string
                    payload?: Json | null
                    type: string
                }
                Update: {
                    actor_id?: string | null
                    agency_id?: string
                    contact_id?: string
                    created_at?: string | null
                    deal_id?: string | null
                    id?: string
                    payload?: Json | null
                    type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "activities_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "activities_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
            agencies: {
                Row: {
                    created_at: string | null
                    id: string
                    name: string
                    timezone: string
                    vapi_settings: Json | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    name: string
                    timezone?: string
                    vapi_settings?: Json | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    name?: string
                    timezone?: string
                    vapi_settings?: Json | null
                }
                Relationships: []
            }
            ai_tasks: {
                Row: {
                    action: Database["public"]["Enums"]["ai_action"]
                    agency_id: string
                    attempts: number
                    correlation_key: string | null
                    created_at: string | null
                    created_by: string
                    deal_id: string
                    finished_at: string | null
                    id: string
                    last_error: string | null
                    payload_json: Json | null
                    priority: number
                    queued_at: string | null
                    scheduled_at: string
                    status: Database["public"]["Enums"]["ai_status"]
                }
                Insert: {
                    action: Database["public"]["Enums"]["ai_action"]
                    agency_id: string
                    attempts?: number
                    correlation_key?: string | null
                    created_at?: string | null
                    created_by?: string
                    deal_id: string
                    finished_at?: string | null
                    id?: string
                    last_error?: string | null
                    payload_json?: Json | null
                    priority?: number
                    queued_at?: string | null
                    scheduled_at: string
                    status?: Database["public"]["Enums"]["ai_status"]
                }
                Update: {
                    action?: Database["public"]["Enums"]["ai_action"]
                    agency_id?: string
                    attempts?: number
                    correlation_key?: string | null
                    created_at?: string | null
                    created_by?: string
                    deal_id?: string
                    finished_at?: string | null
                    id?: string
                    last_error?: string | null
                    payload_json?: Json | null
                    priority?: number
                    queued_at?: string | null
                    scheduled_at?: string
                    status?: Database["public"]["Enums"]["ai_status"]
                }
                Relationships: [
                    {
                        foreignKeyName: "ai_tasks_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
            ai_workflow_templates: {
                Row: {
                    agency_id: string
                    created_at: string | null
                    id: string
                    name: string
                    steps: Json
                }
                Insert: {
                    agency_id: string
                    created_at?: string | null
                    id?: string
                    name: string
                    steps?: Json
                }
                Update: {
                    agency_id?: string
                    created_at?: string | null
                    id?: string
                    name?: string
                    steps?: Json
                }
                Relationships: [
                    {
                        foreignKeyName: "ai_workflow_templates_agency_id_fkey"
                        columns: ["agency_id"]
                        isOneToOne: false
                        referencedRelation: "agencies"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contact_communications: {
                Row: {
                    agency_id: string
                    channel: string
                    contact_id: string
                    created_at: string | null
                    direction: string
                    id: string
                    payload: Json | null
                    status: string
                    updated_at: string | null
                }
                Insert: {
                    agency_id: string
                    channel: string
                    contact_id: string
                    created_at?: string | null
                    direction: string
                    id?: string
                    payload?: Json | null
                    status: string
                    updated_at?: string | null
                }
                Update: {
                    agency_id?: string
                    channel?: string
                    contact_id?: string
                    created_at?: string | null
                    direction?: string
                    id?: string
                    payload?: Json | null
                    status?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "contact_communications_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contact_group_members: {
                Row: {
                    added_at: string | null
                    added_by: string | null
                    contact_id: string
                    group_id: string
                    id: string
                }
                Insert: {
                    added_at?: string | null
                    added_by?: string | null
                    contact_id: string
                    group_id: string
                    id?: string
                }
                Update: {
                    added_at?: string | null
                    added_by?: string | null
                    contact_id?: string
                    group_id?: string
                    id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "contact_group_members_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "contact_group_members_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "contact_groups"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contact_groups: {
                Row: {
                    agency_id: string
                    color: string | null
                    created_at: string | null
                    created_by: string | null
                    description: string | null
                    filter_criteria: Json | null
                    id: string
                    name: string
                    updated_at: string | null
                }
                Insert: {
                    agency_id: string
                    color?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    description?: string | null
                    filter_criteria?: Json | null
                    id?: string
                    name: string
                    updated_at?: string | null
                }
                Update: {
                    agency_id?: string
                    color?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    description?: string | null
                    filter_criteria?: Json | null
                    id?: string
                    name?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "contact_groups_agency_id_fkey"
                        columns: ["agency_id"]
                        isOneToOne: false
                        referencedRelation: "agencies"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contact_profiles: {
                Row: {
                    a_class: boolean | null
                    ad_alias: string | null
                    ad_name: string | null
                    age_25_35: boolean | null
                    age_36_50: boolean | null
                    age_51_plus: boolean | null
                    b_class: boolean | null
                    call_transcription: string | null
                    company_name: string | null
                    contact_id: string
                    contact_owner: string | null
                    created_at: string
                    created_by_user_id: number | null
                    email: string | null
                    favorites: number | null
                    financing_method: string | null
                    first_name: string | null
                    funding_foreign_loan: boolean | null
                    funding_mortgage: boolean | null
                    gender_female: boolean | null
                    gender_male: boolean | null
                    hobby: string | null
                    id: number
                    income_50k_100k: boolean | null
                    income_gt_100k: boolean | null
                    income_lt_50k: boolean | null
                    income_range_interest: string | null
                    industry: string | null
                    investment_views: number | null
                    ip_city: string | null
                    ip_country: string | null
                    job_title: string | null
                    language_primary: string | null
                    last_call_result: string | null
                    last_name: string | null
                    last_touch_channel: string | null
                    lead_status: string | null
                    marital_couple: boolean | null
                    marital_single: boolean | null
                    marital_with_children: boolean | null
                    nationality: string | null
                    owns_property_elsewhere: boolean | null
                    phone: string | null
                    prefers_email_contact: boolean | null
                    prefers_phone_contact: boolean | null
                    profession_it: string | null
                    profession_retired: boolean | null
                    qualification_notes: string | null
                    qualification_status: string | null
                    ready_for_qualification: boolean | null
                    record_source: string | null
                    record_source_detail_1: string | null
                    residence_country: string | null
                    score: number | null
                    summary: string | null
                    timezone: string | null
                    trip_planned: string | null
                    unsubscribe_email: boolean
                    visited_location_before: boolean | null
                    z_class: boolean | null
                }
                Insert: {
                    a_class?: boolean | null
                    ad_alias?: string | null
                    ad_name?: string | null
                    age_25_35?: boolean | null
                    age_36_50?: boolean | null
                    age_51_plus?: boolean | null
                    b_class?: boolean | null
                    call_transcription?: string | null
                    company_name?: string | null
                    contact_id: string
                    contact_owner?: string | null
                    created_at?: string
                    created_by_user_id?: number | null
                    email?: string | null
                    favorites?: number | null
                    financing_method?: string | null
                    first_name?: string | null
                    funding_foreign_loan?: boolean | null
                    funding_mortgage?: boolean | null
                    gender_female?: boolean | null
                    gender_male?: boolean | null
                    hobby?: string | null
                    id?: number
                    income_50k_100k?: boolean | null
                    income_gt_100k?: boolean | null
                    income_lt_50k?: boolean | null
                    income_range_interest?: string | null
                    industry?: string | null
                    investment_views?: number | null
                    ip_city?: string | null
                    ip_country?: string | null
                    job_title?: string | null
                    language_primary?: string | null
                    last_call_result?: string | null
                    last_name?: string | null
                    last_touch_channel?: string | null
                    lead_status?: string | null
                    marital_couple?: boolean | null
                    marital_single?: boolean | null
                    marital_with_children?: boolean | null
                    nationality?: string | null
                    owns_property_elsewhere?: boolean | null
                    phone?: string | null
                    prefers_email_contact?: boolean | null
                    prefers_phone_contact?: boolean | null
                    profession_it?: string | null
                    profession_retired?: boolean | null
                    qualification_notes?: string | null
                    qualification_status?: string | null
                    ready_for_qualification?: boolean | null
                    record_source?: string | null
                    record_source_detail_1?: string | null
                    residence_country?: string | null
                    score?: number | null
                    summary?: string | null
                    timezone?: string | null
                    trip_planned?: string | null
                    unsubscribe_email?: boolean
                    visited_location_before?: boolean | null
                    z_class?: boolean | null
                }
                Update: {
                    a_class?: boolean | null
                    ad_alias?: string | null
                    ad_name?: string | null
                    age_25_35?: boolean | null
                    age_36_50?: boolean | null
                    age_51_plus?: boolean | null
                    b_class?: boolean | null
                    call_transcription?: string | null
                    company_name?: string | null
                    contact_id?: string
                    contact_owner?: string | null
                    created_at?: string
                    created_by_user_id?: number | null
                    email?: string | null
                    favorites?: number | null
                    financing_method?: string | null
                    first_name?: string | null
                    funding_foreign_loan?: boolean | null
                    funding_mortgage?: boolean | null
                    gender_female?: boolean | null
                    gender_male?: boolean | null
                    hobby?: string | null
                    id?: number
                    income_50k_100k?: boolean | null
                    income_gt_100k?: boolean | null
                    income_lt_50k?: boolean | null
                    income_range_interest?: string | null
                    industry?: string | null
                    investment_views?: number | null
                    ip_city?: string | null
                    ip_country?: string | null
                    job_title?: string | null
                    language_primary?: string | null
                    last_call_result?: string | null
                    last_name?: string | null
                    last_touch_channel?: string | null
                    lead_status?: string | null
                    marital_couple?: boolean | null
                    marital_single?: boolean | null
                    marital_with_children?: boolean | null
                    nationality?: string | null
                    owns_property_elsewhere?: boolean | null
                    phone?: string | null
                    prefers_email_contact?: boolean | null
                    prefers_phone_contact?: boolean | null
                    profession_it?: string | null
                    profession_retired?: boolean | null
                    qualification_notes?: string | null
                    qualification_status?: string | null
                    ready_for_qualification?: boolean | null
                    record_source?: string | null
                    record_source_detail_1?: string | null
                    residence_country?: string | null
                    score?: number | null
                    summary?: string | null
                    timezone?: string | null
                    trip_planned?: string | null
                    unsubscribe_email?: boolean
                    visited_location_before?: boolean | null
                    z_class?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "contact_profiles_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            contacts: {
                Row: {
                    agency_id: string
                    assignee_id: string | null
                    call_attempts: number | null
                    call_today_count: number | null
                    created_at: string | null
                    current_deal_id: string | null
                    current_status: Database["public"]["Enums"]["deal_status"] | null
                    emails: string[] | null
                    first_name: string | null
                    group_id: string | null
                    id: string
                    last_call_at: string | null
                    last_name: string | null
                    owner: string | null
                    phones: string[] | null
                    primary_email: string | null
                    primary_phone: string | null
                    qualification_status: string | null
                    updated_at: string | null
                }
                Insert: {
                    agency_id: string
                    assignee_id?: string | null
                    call_attempts?: number | null
                    call_today_count?: number | null
                    created_at?: string | null
                    current_deal_id?: string | null
                    current_status?: Database["public"]["Enums"]["deal_status"] | null
                    emails?: string[] | null
                    first_name?: string | null
                    group_id?: string | null
                    id?: string
                    last_call_at?: string | null
                    last_name?: string | null
                    owner?: string | null
                    phones?: string[] | null
                    primary_email?: string | null
                    primary_phone?: string | null
                    qualification_status?: string | null
                    updated_at?: string | null
                }
                Update: {
                    agency_id?: string
                    assignee_id?: string | null
                    call_attempts?: number | null
                    call_today_count?: number | null
                    created_at?: string | null
                    current_deal_id?: string | null
                    current_status?: Database["public"]["Enums"]["deal_status"] | null
                    emails?: string[] | null
                    first_name?: string | null
                    group_id?: string | null
                    id?: string
                    last_call_at?: string | null
                    last_name?: string | null
                    owner?: string | null
                    phones?: string[] | null
                    primary_email?: string | null
                    primary_phone?: string | null
                    qualification_status?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "contacts_agency_id_fkey"
                        columns: ["agency_id"]
                        isOneToOne: false
                        referencedRelation: "agencies"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "contacts_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "contact_groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "contacts_owner_fkey"
                        columns: ["owner"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            deal_preference_profiles: {
                Row: {
                    area: string | null
                    bathrooms: number | null
                    bedrooms: number | null
                    budget: number | null
                    build_type_new: boolean | null
                    build_type_secondhand: boolean | null
                    city: string | null
                    climate_control_air_conditioning: boolean | null
                    climate_control_central_heating: boolean | null
                    climate_control_fireplace: boolean | null
                    climate_control_uf_heating: boolean | null
                    climate_control_ufh_bathrooms: boolean | null
                    condition_new_build: boolean | null
                    condition_recently_renovated: boolean | null
                    condition_renovation_ok: boolean | null
                    condition_resale: boolean | null
                    condition_restoration_required: boolean | null
                    country: string | null
                    created_at: string
                    deal_id: string
                    dist_beach_lt_1km: boolean | null
                    duplex: boolean | null
                    feature_access_for_reduced_mobility: boolean | null
                    feature_balcony: boolean | null
                    feature_bar: boolean | null
                    feature_bar_restaurant: boolean | null
                    feature_barbeque: boolean | null
                    feature_basement: boolean | null
                    feature_car_hire_facility: boolean | null
                    feature_children_playground: boolean | null
                    feature_chill_out_area: boolean | null
                    feature_concierge_service: boolean | null
                    feature_courtesy_bus: boolean | null
                    feature_covered_terrace: boolean | null
                    feature_coworking_area: boolean | null
                    feature_dedicated_workspace: boolean | null
                    feature_domotics: boolean | null
                    feature_ensuite_bathroom: boolean | null
                    feature_ev_charger: boolean | null
                    feature_fiber_optic: boolean | null
                    feature_fitted_wardrobes: boolean | null
                    feature_games_room: boolean | null
                    feature_garage: boolean | null
                    feature_garden: boolean | null
                    feature_gated_community: boolean | null
                    feature_guest_apartment: boolean | null
                    feature_guest_house: boolean | null
                    feature_gym: boolean | null
                    feature_jacuzzi: boolean | null
                    feature_laundry: boolean | null
                    feature_lift: boolean | null
                    feature_marble_flooring: boolean | null
                    feature_mountain_view: boolean | null
                    feature_near_church: boolean | null
                    feature_near_mosque: boolean | null
                    feature_near_transport: boolean | null
                    feature_outside_gym: boolean | null
                    feature_paddle_tennis: boolean | null
                    feature_padel_court_tennis_court: boolean | null
                    feature_pool: boolean | null
                    feature_private_parking: boolean | null
                    feature_private_pool: boolean | null
                    feature_restaurant_on_site: boolean | null
                    feature_satellite_tv: boolean | null
                    feature_sauna: boolean | null
                    feature_sea_view: boolean | null
                    feature_solarium: boolean | null
                    feature_spa: boolean | null
                    feature_stables: boolean | null
                    feature_staff_accommodation: boolean | null
                    feature_storage_room: boolean | null
                    feature_terrace: boolean | null
                    feature_utility_room: boolean | null
                    feature_yoga_area: boolean | null
                    furniture_fully_furnished: boolean | null
                    furniture_not_furnished: boolean | null
                    id: number
                    kitchen_fully_fitted: boolean | null
                    kitchen_kitchen_lounge: boolean | null
                    kitchen_partially_fitted: boolean | null
                    loc_city_center: boolean | null
                    loc_coast: boolean | null
                    loc_rural: boolean | null
                    loc_suburbs: boolean | null
                    location_type_beachfront: boolean | null
                    location_type_beachside: boolean | null
                    location_type_close_to_forest: boolean | null
                    location_type_close_to_golf: boolean | null
                    location_type_close_to_marina: boolean | null
                    location_type_close_to_port: boolean | null
                    location_type_close_to_schools: boolean | null
                    location_type_close_to_sea: boolean | null
                    location_type_close_to_shops: boolean | null
                    location_type_close_to_town: boolean | null
                    location_type_country: boolean | null
                    location_type_front_line_beach_complex: boolean | null
                    location_type_frontline_golf: boolean | null
                    location_type_marina: boolean | null
                    location_type_mountain_pueblo: boolean | null
                    location_type_port: boolean | null
                    location_type_suburban: boolean | null
                    location_type_town: boolean | null
                    location_type_urbanisation: boolean | null
                    location_type_village: boolean | null
                    main_home: boolean | null
                    max_budget: number | null
                    parking_gated: boolean | null
                    parking_private: boolean | null
                    parking_underground: boolean | null
                    pool_childrens_pool: boolean | null
                    pool_communal: boolean | null
                    pool_heated: boolean | null
                    pool_indoor: boolean | null
                    pool_private: boolean | null
                    region: string | null
                    second_home: boolean | null
                    security_24_hour_security: boolean | null
                    security_electric_blinds: boolean | null
                    security_gated_complex: boolean | null
                    size_sq_m: number | null
                    subtype_duplex: boolean | null
                    subtype_finca_cortijo: boolean | null
                    subtype_ground_floor_apartment: boolean | null
                    subtype_ground_floor_studio: boolean | null
                    subtype_middle_floor_apartment: boolean | null
                    subtype_middle_floor_studio: boolean | null
                    subtype_mobile_home: boolean | null
                    subtype_penthouse: boolean | null
                    subtype_penthouse_duplex: boolean | null
                    subtype_semi_detached_house: boolean | null
                    subtype_top_floor_apartment: boolean | null
                    subtype_top_floor_studio: boolean | null
                    type_apartment: boolean | null
                    type_land_plot: boolean | null
                    type_townhouse: boolean | null
                    type_villa: boolean | null
                    view_beach: boolean | null
                    view_country: boolean | null
                    view_courtyard: boolean | null
                    view_forest: boolean | null
                    view_garden: boolean | null
                    view_golf: boolean | null
                    view_lake: boolean | null
                    view_mountain: boolean | null
                    view_panoramic: boolean | null
                    view_pool: boolean | null
                    view_port: boolean | null
                    view_sea: boolean | null
                    view_street: boolean | null
                    view_urban: boolean | null
                    want_long_term_rental: boolean | null
                    want_short_term_rental: boolean | null
                }
                Insert: {
                    area?: string | null
                    bathrooms?: number | null
                    bedrooms?: number | null
                    budget?: number | null
                    build_type_new?: boolean | null
                    build_type_secondhand?: boolean | null
                    city?: string | null
                    climate_control_air_conditioning?: boolean | null
                    climate_control_central_heating?: boolean | null
                    climate_control_fireplace?: boolean | null
                    climate_control_uf_heating?: boolean | null
                    climate_control_ufh_bathrooms?: boolean | null
                    condition_new_build?: boolean | null
                    condition_recently_renovated?: boolean | null
                    condition_renovation_ok?: boolean | null
                    condition_resale?: boolean | null
                    condition_restoration_required?: boolean | null
                    country?: string | null
                    created_at?: string
                    deal_id: string
                    dist_beach_lt_1km?: boolean | null
                    duplex?: boolean | null
                    feature_access_for_reduced_mobility?: boolean | null
                    feature_balcony?: boolean | null
                    feature_bar?: boolean | null
                    feature_bar_restaurant?: boolean | null
                    feature_barbeque?: boolean | null
                    feature_basement?: boolean | null
                    feature_car_hire_facility?: boolean | null
                    feature_children_playground?: boolean | null
                    feature_chill_out_area?: boolean | null
                    feature_concierge_service?: boolean | null
                    feature_courtesy_bus?: boolean | null
                    feature_covered_terrace?: boolean | null
                    feature_coworking_area?: boolean | null
                    feature_dedicated_workspace?: boolean | null
                    feature_domotics?: boolean | null
                    feature_ensuite_bathroom?: boolean | null
                    feature_ev_charger?: boolean | null
                    feature_fiber_optic?: boolean | null
                    feature_fitted_wardrobes?: boolean | null
                    feature_games_room?: boolean | null
                    feature_garage?: boolean | null
                    feature_garden?: boolean | null
                    feature_gated_community?: boolean | null
                    feature_guest_apartment?: boolean | null
                    feature_guest_house?: boolean | null
                    feature_gym?: boolean | null
                    feature_jacuzzi?: boolean | null
                    feature_laundry?: boolean | null
                    feature_lift?: boolean | null
                    feature_marble_flooring?: boolean | null
                    feature_mountain_view?: boolean | null
                    feature_near_church?: boolean | null
                    feature_near_mosque?: boolean | null
                    feature_near_transport?: boolean | null
                    feature_outside_gym?: boolean | null
                    feature_paddle_tennis?: boolean | null
                    feature_padel_court_tennis_court?: boolean | null
                    feature_pool?: boolean | null
                    feature_private_parking?: boolean | null
                    feature_private_pool?: boolean | null
                    feature_restaurant_on_site?: boolean | null
                    feature_satellite_tv?: boolean | null
                    feature_sauna?: boolean | null
                    feature_sea_view?: boolean | null
                    feature_solarium?: boolean | null
                    feature_spa?: boolean | null
                    feature_stables?: boolean | null
                    feature_staff_accommodation?: boolean | null
                    feature_storage_room?: boolean | null
                    feature_terrace?: boolean | null
                    feature_utility_room?: boolean | null
                    feature_yoga_area?: boolean | null
                    furniture_fully_furnished?: boolean | null
                    furniture_not_furnished?: boolean | null
                    id?: number
                    kitchen_fully_fitted?: boolean | null
                    kitchen_kitchen_lounge?: boolean | null
                    kitchen_partially_fitted?: boolean | null
                    loc_city_center?: boolean | null
                    loc_coast?: boolean | null
                    loc_rural?: boolean | null
                    loc_suburbs?: boolean | null
                    location_type_beachfront?: boolean | null
                    location_type_beachside?: boolean | null
                    location_type_close_to_forest?: boolean | null
                    location_type_close_to_golf?: boolean | null
                    location_type_close_to_marina?: boolean | null
                    location_type_close_to_port?: boolean | null
                    location_type_close_to_schools?: boolean | null
                    location_type_close_to_sea?: boolean | null
                    location_type_close_to_shops?: boolean | null
                    location_type_close_to_town?: boolean | null
                    location_type_country?: boolean | null
                    location_type_front_line_beach_complex?: boolean | null
                    location_type_frontline_golf?: boolean | null
                    location_type_marina?: boolean | null
                    location_type_mountain_pueblo?: boolean | null
                    location_type_port?: boolean | null
                    location_type_suburban?: boolean | null
                    location_type_town?: boolean | null
                    location_type_urbanisation?: boolean | null
                    location_type_village?: boolean | null
                    main_home?: boolean | null
                    max_budget?: number | null
                    parking_gated?: boolean | null
                    parking_private?: boolean | null
                    parking_underground?: boolean | null
                    pool_childrens_pool?: boolean | null
                    pool_communal?: boolean | null
                    pool_heated?: boolean | null
                    pool_indoor?: boolean | null
                    pool_private?: boolean | null
                    region?: string | null
                    second_home?: boolean | null
                    security_24_hour_security?: boolean | null
                    security_electric_blinds?: boolean | null
                    security_gated_complex?: boolean | null
                    size_sq_m?: number | null
                    subtype_duplex?: boolean | null
                    subtype_finca_cortijo?: boolean | null
                    subtype_ground_floor_apartment?: boolean | null
                    subtype_ground_floor_studio?: boolean | null
                    subtype_middle_floor_apartment?: boolean | null
                    subtype_middle_floor_studio?: boolean | null
                    subtype_mobile_home?: boolean | null
                    subtype_penthouse?: boolean | null
                    subtype_penthouse_duplex?: boolean | null
                    subtype_semi_detached_house?: boolean | null
                    subtype_top_floor_apartment?: boolean | null
                    subtype_top_floor_studio?: boolean | null
                    type_apartment?: boolean | null
                    type_land_plot?: boolean | null
                    type_townhouse?: boolean | null
                    type_villa?: boolean | null
                    view_beach?: boolean | null
                    view_country?: boolean | null
                    view_courtyard?: boolean | null
                    view_forest?: boolean | null
                    view_garden?: boolean | null
                    view_golf?: boolean | null
                    view_lake?: boolean | null
                    view_mountain?: boolean | null
                    view_panoramic?: boolean | null
                    view_pool?: boolean | null
                    view_port?: boolean | null
                    view_sea?: boolean | null
                    view_street?: boolean | null
                    view_urban?: boolean | null
                    want_long_term_rental?: boolean | null
                    want_short_term_rental?: boolean | null
                }
                Update: {
                    area?: string | null
                    bathrooms?: number | null
                    bedrooms?: number | null
                    budget?: number | null
                    build_type_new?: boolean | null
                    build_type_secondhand?: boolean | null
                    city?: string | null
                    climate_control_air_conditioning?: boolean | null
                    climate_control_central_heating?: boolean | null
                    climate_control_fireplace?: boolean | null
                    climate_control_uf_heating?: boolean | null
                    climate_control_ufh_bathrooms?: boolean | null
                    condition_new_build?: boolean | null
                    condition_recently_renovated?: boolean | null
                    condition_renovation_ok?: boolean | null
                    condition_resale?: boolean | null
                    condition_restoration_required?: boolean | null
                    country?: string | null
                    created_at?: string
                    deal_id?: string
                    dist_beach_lt_1km?: boolean | null
                    duplex?: boolean | null
                    feature_access_for_reduced_mobility?: boolean | null
                    feature_balcony?: boolean | null
                    feature_bar?: boolean | null
                    feature_bar_restaurant?: boolean | null
                    feature_barbeque?: boolean | null
                    feature_basement?: boolean | null
                    feature_car_hire_facility?: boolean | null
                    feature_children_playground?: boolean | null
                    feature_chill_out_area?: boolean | null
                    feature_concierge_service?: boolean | null
                    feature_courtesy_bus?: boolean | null
                    feature_covered_terrace?: boolean | null
                    feature_coworking_area?: boolean | null
                    feature_dedicated_workspace?: boolean | null
                    feature_domotics?: boolean | null
                    feature_ensuite_bathroom?: boolean | null
                    feature_ev_charger?: boolean | null
                    feature_fiber_optic?: boolean | null
                    feature_fitted_wardrobes?: boolean | null
                    feature_games_room?: boolean | null
                    feature_garage?: boolean | null
                    feature_garden?: boolean | null
                    feature_gated_community?: boolean | null
                    feature_guest_apartment?: boolean | null
                    feature_guest_house?: boolean | null
                    feature_gym?: boolean | null
                    feature_jacuzzi?: boolean | null
                    feature_laundry?: boolean | null
                    feature_lift?: boolean | null
                    feature_marble_flooring?: boolean | null
                    feature_mountain_view?: boolean | null
                    feature_near_church?: boolean | null
                    feature_near_mosque?: boolean | null
                    feature_near_transport?: boolean | null
                    feature_outside_gym?: boolean | null
                    feature_paddle_tennis?: boolean | null
                    feature_padel_court_tennis_court?: boolean | null
                    feature_pool?: boolean | null
                    feature_private_parking?: boolean | null
                    feature_private_pool?: boolean | null
                    feature_restaurant_on_site?: boolean | null
                    feature_satellite_tv?: boolean | null
                    feature_sauna?: boolean | null
                    feature_sea_view?: boolean | null
                    feature_solarium?: boolean | null
                    feature_spa?: boolean | null
                    feature_stables?: boolean | null
                    feature_staff_accommodation?: boolean | null
                    feature_storage_room?: boolean | null
                    feature_terrace?: boolean | null
                    feature_utility_room?: boolean | null
                    feature_yoga_area?: boolean | null
                    furniture_fully_furnished?: boolean | null
                    furniture_not_furnished?: boolean | null
                    id?: number
                    kitchen_fully_fitted?: boolean | null
                    kitchen_kitchen_lounge?: boolean | null
                    kitchen_partially_fitted?: boolean | null
                    loc_city_center?: boolean | null
                    loc_coast?: boolean | null
                    loc_rural?: boolean | null
                    loc_suburbs?: boolean | null
                    location_type_beachfront?: boolean | null
                    location_type_beachside?: boolean | null
                    location_type_close_to_forest?: boolean | null
                    location_type_close_to_golf?: boolean | null
                    location_type_close_to_marina?: boolean | null
                    location_type_close_to_port?: boolean | null
                    location_type_close_to_schools?: boolean | null
                    location_type_close_to_sea?: boolean | null
                    location_type_close_to_shops?: boolean | null
                    location_type_close_to_town?: boolean | null
                    location_type_country?: boolean | null
                    location_type_front_line_beach_complex?: boolean | null
                    location_type_frontline_golf?: boolean | null
                    location_type_marina?: boolean | null
                    location_type_mountain_pueblo?: boolean | null
                    location_type_port?: boolean | null
                    location_type_suburban?: boolean | null
                    location_type_town?: boolean | null
                    location_type_urbanisation?: boolean | null
                    location_type_village?: boolean | null
                    main_home?: boolean | null
                    max_budget?: number | null
                    parking_gated?: boolean | null
                    parking_private?: boolean | null
                    parking_underground?: boolean | null
                    pool_childrens_pool?: boolean | null
                    pool_communal?: boolean | null
                    pool_heated?: boolean | null
                    pool_indoor?: boolean | null
                    pool_private?: boolean | null
                    region?: string | null
                    second_home?: boolean | null
                    security_24_hour_security?: boolean | null
                    security_electric_blinds?: boolean | null
                    security_gated_complex?: boolean | null
                    size_sq_m?: number | null
                    subtype_duplex?: boolean | null
                    subtype_finca_cortijo?: boolean | null
                    subtype_ground_floor_apartment?: boolean | null
                    subtype_ground_floor_studio?: boolean | null
                    subtype_middle_floor_apartment?: boolean | null
                    subtype_middle_floor_studio?: boolean | null
                    subtype_mobile_home?: boolean | null
                    subtype_penthouse?: boolean | null
                    subtype_penthouse_duplex?: boolean | null
                    subtype_semi_detached_house?: boolean | null
                    subtype_top_floor_apartment?: boolean | null
                    subtype_top_floor_studio?: boolean | null
                    type_apartment?: boolean | null
                    type_land_plot?: boolean | null
                    type_townhouse?: boolean | null
                    type_villa?: boolean | null
                    view_beach?: boolean | null
                    view_country?: boolean | null
                    view_courtyard?: boolean | null
                    view_forest?: boolean | null
                    view_garden?: boolean | null
                    view_golf?: boolean | null
                    view_lake?: boolean | null
                    view_mountain?: boolean | null
                    view_panoramic?: boolean | null
                    view_pool?: boolean | null
                    view_port?: boolean | null
                    view_sea?: boolean | null
                    view_street?: boolean | null
                    view_urban?: boolean | null
                    want_long_term_rental?: boolean | null
                    want_short_term_rental?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "deal_preference_profiles_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
            deals: {
                Row: {
                    agency_id: string
                    ai_first_touch_at: string | null
                    ai_hot: boolean | null
                    ai_hot_reason: string | null
                    ai_hot_score: number | null
                    ai_last_touch_at: string | null
                    ai_mode: Database["public"]["Enums"]["ai_mode_type"]
                    ai_summary: string | null
                    areas: string[] | null
                    budget_max: number | null
                    budget_min: number | null
                    closed_at: string | null
                    commission_value: number | null
                    contact_id: string
                    created_at: string | null
                    currency: string | null
                    external_ids: Json | null
                    id: string
                    last_selection_sent_at: string | null
                    must_haves: string[] | null
                    next_selection_at: string | null
                    nice_to_haves: string[] | null
                    nurture_day: number | null
                    nurture_enabled: boolean | null
                    nurture_time: string | null
                    offer_price: number | null
                    opened_at: string | null
                    primary_agent_id: string | null
                    property_types: string[] | null
                    segment: Database["public"]["Enums"]["segment_type"]
                    status: Database["public"]["Enums"]["deal_status"]
                    type: Database["public"]["Enums"]["deal_type"]
                    updated_at: string | null
                    won_price: number | null
                }
                Insert: {
                    agency_id: string
                    ai_first_touch_at?: string | null
                    ai_hot?: boolean | null
                    ai_hot_reason?: string | null
                    ai_hot_score?: number | null
                    ai_last_touch_at?: string | null
                    ai_mode?: Database["public"]["Enums"]["ai_mode_type"]
                    ai_summary?: string | null
                    areas?: string[] | null
                    budget_max?: number | null
                    budget_min?: number | null
                    closed_at?: string | null
                    commission_value?: number | null
                    contact_id: string
                    created_at?: string | null
                    currency?: string | null
                    external_ids?: Json | null
                    id?: string
                    last_selection_sent_at?: string | null
                    must_haves?: string[] | null
                    next_selection_at?: string | null
                    nice_to_haves?: string[] | null
                    nurture_day?: number | null
                    nurture_enabled?: boolean | null
                    nurture_time?: string | null
                    offer_price?: number | null
                    opened_at?: string | null
                    primary_agent_id?: string | null
                    property_types?: string[] | null
                    segment?: Database["public"]["Enums"]["segment_type"]
                    status?: Database["public"]["Enums"]["deal_status"]
                    type: Database["public"]["Enums"]["deal_type"]
                    updated_at?: string | null
                    won_price?: number | null
                }
                Update: {
                    agency_id?: string
                    ai_first_touch_at?: string | null
                    ai_hot?: boolean | null
                    ai_hot_reason?: string | null
                    ai_hot_score?: number | null
                    ai_last_touch_at?: string | null
                    ai_mode?: Database["public"]["Enums"]["ai_mode_type"]
                    ai_summary?: string | null
                    areas?: string[] | null
                    budget_max?: number | null
                    budget_min?: number | null
                    closed_at?: string | null
                    commission_value?: number | null
                    contact_id?: string
                    created_at?: string | null
                    currency?: string | null
                    external_ids?: Json | null
                    id?: string
                    last_selection_sent_at?: string | null
                    must_haves?: string[] | null
                    next_selection_at?: string | null
                    nice_to_haves?: string[] | null
                    nurture_day?: number | null
                    nurture_enabled?: boolean | null
                    nurture_time?: string | null
                    offer_price?: number | null
                    opened_at?: string | null
                    primary_agent_id?: string | null
                    property_types?: string[] | null
                    segment?: Database["public"]["Enums"]["segment_type"]
                    status?: Database["public"]["Enums"]["deal_status"]
                    type?: Database["public"]["Enums"]["deal_type"]
                    updated_at?: string | null
                    won_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "deals_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            features: {
                Row: {
                    created_at: string
                    group_key: string
                    icon: string | null
                    id: string
                    name: string
                    parent_id: string | null
                    property_types: Database["public"]["Enums"]["property_type"][]
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    group_key: string
                    icon?: string | null
                    id?: string
                    name: string
                    parent_id?: string | null
                    property_types?: Database["public"]["Enums"]["property_type"][]
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    group_key?: string
                    icon?: string | null
                    id?: string
                    name?: string
                    parent_id?: string | null
                    property_types?: Database["public"]["Enums"]["property_type"][]
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "features_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                ]
            }
            locations: {
                Row: {
                    created_at: string
                    description: string | null
                    id: string
                    latitude: number | null
                    longitude: number | null
                    name: string
                    parent_id: string | null
                    picture: string | null
                    type: Database["public"]["Enums"]["location_type"]
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    description?: string | null
                    id?: string
                    latitude?: number | null
                    longitude?: number | null
                    name: string
                    parent_id?: string | null
                    picture?: string | null
                    type: Database["public"]["Enums"]["location_type"]
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    description?: string | null
                    id?: string
                    latitude?: number | null
                    longitude?: number | null
                    name?: string
                    parent_id?: string | null
                    picture?: string | null
                    type?: Database["public"]["Enums"]["location_type"]
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "locations_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                ]
            }
            memberships: {
                Row: {
                    active: boolean
                    agency_id: string
                    id: string
                    role: Database["public"]["Enums"]["role_type"]
                    user_id: string
                }
                Insert: {
                    active?: boolean
                    agency_id: string
                    id?: string
                    role?: Database["public"]["Enums"]["role_type"]
                    user_id: string
                }
                Update: {
                    active?: boolean
                    agency_id?: string
                    id?: string
                    role?: Database["public"]["Enums"]["role_type"]
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "memberships_agency_id_fkey"
                        columns: ["agency_id"]
                        isOneToOne: false
                        referencedRelation: "agencies"
                        referencedColumns: ["id"]
                    },
                ]
            }
            messages: {
                Row: {
                    agency_id: string
                    body_text: string | null
                    channel: string
                    contact_id: string
                    created_at: string | null
                    deal_id: string | null
                    direction: string
                    from_addr: string | null
                    id: string
                    provider_meta: Json | null
                    sent_at: string | null
                    status: string | null
                    subject: string | null
                    to_addrs: string[] | null
                }
                Insert: {
                    agency_id: string
                    body_text?: string | null
                    channel: string
                    contact_id: string
                    created_at?: string | null
                    deal_id?: string | null
                    direction: string
                    from_addr?: string | null
                    id?: string
                    provider_meta?: Json | null
                    sent_at?: string | null
                    status?: string | null
                    subject?: string | null
                    to_addrs?: string[] | null
                }
                Update: {
                    agency_id?: string
                    body_text?: string | null
                    channel?: string
                    contact_id?: string
                    created_at?: string | null
                    deal_id?: string | null
                    direction?: string
                    from_addr?: string | null
                    id?: string
                    provider_meta?: Json | null
                    sent_at?: string | null
                    status?: string | null
                    subject?: string | null
                    to_addrs?: string[] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "messages_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "messages_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    agency_id: string | null
                    created_at: string | null
                    full_name: string | null
                    id: string
                    phone: string | null
                    role: Database["public"]["Enums"]["member_role"] | null
                }
                Insert: {
                    agency_id?: string | null
                    created_at?: string | null
                    full_name?: string | null
                    id: string
                    phone?: string | null
                    role?: Database["public"]["Enums"]["member_role"] | null
                }
                Update: {
                    agency_id?: string | null
                    created_at?: string | null
                    full_name?: string | null
                    id?: string
                    phone?: string | null
                    role?: Database["public"]["Enums"]["member_role"] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_agency_id_fkey"
                        columns: ["agency_id"]
                        isOneToOne: false
                        referencedRelation: "agencies"
                        referencedColumns: ["id"]
                    },
                ]
            }
            properties: {
                Row: {
                    address: string | null
                    area_id: string | null
                    avg_annual_rental_income: number | null
                    bathrooms: number | null
                    bedrooms: number | null
                    build_type_id: string | null
                    built_size: number | null
                    community_fees: number | null
                    completion_date_at: string | null
                    completion_type_id: string | null
                    condition_id: string | null
                    content: string | null
                    country_id: string | null
                    created_at: string
                    floor: number | null
                    garbage_tax: number | null
                    garden_plot_size: number | null
                    gross_annual_total: number | null
                    guests: number | null
                    house_number: string | null
                    ibi_fees: number | null
                    id: string
                    is_correct_geolocation: boolean
                    latitude: number | null
                    levels: number | null
                    living_size: number | null
                    longitude: number | null
                    municipality_id: string | null
                    name: string | null
                    neighbourhood_id: string | null
                    parent_id: string | null
                    pictures: string[] | null
                    postal_code: string | null
                    price: number | null
                    profit: number | null
                    profit_with_inflation: number | null
                    province_id: string | null
                    resale_ref: string | null
                    short_address: string | null
                    static_map_url: string | null
                    status: Database["public"]["Enums"]["property_status"]
                    street: string | null
                    sub_type_id: string | null
                    terrace_size: number | null
                    type: Database["public"]["Enums"]["property_type"]
                    updated_at: string
                }
                Insert: {
                    address?: string | null
                    area_id?: string | null
                    avg_annual_rental_income?: number | null
                    bathrooms?: number | null
                    bedrooms?: number | null
                    build_type_id?: string | null
                    built_size?: number | null
                    community_fees?: number | null
                    completion_date_at?: string | null
                    completion_type_id?: string | null
                    condition_id?: string | null
                    content?: string | null
                    country_id?: string | null
                    created_at?: string
                    floor?: number | null
                    garbage_tax?: number | null
                    garden_plot_size?: number | null
                    gross_annual_total?: number | null
                    guests?: number | null
                    house_number?: string | null
                    ibi_fees?: number | null
                    id?: string
                    is_correct_geolocation?: boolean
                    latitude?: number | null
                    levels?: number | null
                    living_size?: number | null
                    longitude?: number | null
                    municipality_id?: string | null
                    name?: string | null
                    neighbourhood_id?: string | null
                    parent_id?: string | null
                    pictures?: string[] | null
                    postal_code?: string | null
                    price?: number | null
                    profit?: number | null
                    profit_with_inflation?: number | null
                    province_id?: string | null
                    resale_ref?: string | null
                    short_address?: string | null
                    static_map_url?: string | null
                    status?: Database["public"]["Enums"]["property_status"]
                    street?: string | null
                    sub_type_id?: string | null
                    terrace_size?: number | null
                    type: Database["public"]["Enums"]["property_type"]
                    updated_at?: string
                }
                Update: {
                    address?: string | null
                    area_id?: string | null
                    avg_annual_rental_income?: number | null
                    bathrooms?: number | null
                    bedrooms?: number | null
                    build_type_id?: string | null
                    built_size?: number | null
                    community_fees?: number | null
                    completion_date_at?: string | null
                    completion_type_id?: string | null
                    condition_id?: string | null
                    content?: string | null
                    country_id?: string | null
                    created_at?: string
                    floor?: number | null
                    garbage_tax?: number | null
                    garden_plot_size?: number | null
                    gross_annual_total?: number | null
                    guests?: number | null
                    house_number?: string | null
                    ibi_fees?: number | null
                    id?: string
                    is_correct_geolocation?: boolean
                    latitude?: number | null
                    levels?: number | null
                    living_size?: number | null
                    longitude?: number | null
                    municipality_id?: string | null
                    name?: string | null
                    neighbourhood_id?: string | null
                    parent_id?: string | null
                    pictures?: string[] | null
                    postal_code?: string | null
                    price?: number | null
                    profit?: number | null
                    profit_with_inflation?: number | null
                    province_id?: string | null
                    resale_ref?: string | null
                    short_address?: string | null
                    static_map_url?: string | null
                    status?: Database["public"]["Enums"]["property_status"]
                    street?: string | null
                    sub_type_id?: string | null
                    terrace_size?: number | null
                    type?: Database["public"]["Enums"]["property_type"]
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "properties_area_id_fkey"
                        columns: ["area_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_build_type_id_fkey"
                        columns: ["build_type_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_completion_type_id_fkey"
                        columns: ["completion_type_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_condition_id_fkey"
                        columns: ["condition_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_country_id_fkey"
                        columns: ["country_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_municipality_id_fkey"
                        columns: ["municipality_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_neighbourhood_id_fkey"
                        columns: ["neighbourhood_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "properties"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_province_id_fkey"
                        columns: ["province_id"]
                        isOneToOne: false
                        referencedRelation: "locations"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "properties_sub_type_id_fkey"
                        columns: ["sub_type_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                ]
            }
            property_features: {
                Row: {
                    feature_id: string
                    kind: Database["public"]["Enums"]["property_feature_kind"]
                    property_id: string
                }
                Insert: {
                    feature_id: string
                    kind: Database["public"]["Enums"]["property_feature_kind"]
                    property_id: string
                }
                Update: {
                    feature_id?: string
                    kind?: Database["public"]["Enums"]["property_feature_kind"]
                    property_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "property_features_feature_id_fkey"
                        columns: ["feature_id"]
                        isOneToOne: false
                        referencedRelation: "features"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "property_features_property_id_fkey"
                        columns: ["property_id"]
                        isOneToOne: false
                        referencedRelation: "properties"
                        referencedColumns: ["id"]
                    },
                ]
            }
            property_tags: {
                Row: {
                    property_id: string
                    tag: Database["public"]["Enums"]["property_tag"]
                }
                Insert: {
                    property_id: string
                    tag: Database["public"]["Enums"]["property_tag"]
                }
                Update: {
                    property_id?: string
                    tag?: Database["public"]["Enums"]["property_tag"]
                }
                Relationships: [
                    {
                        foreignKeyName: "property_tags_property_id_fkey"
                        columns: ["property_id"]
                        isOneToOne: false
                        referencedRelation: "properties"
                        referencedColumns: ["id"]
                    },
                ]
            }
            provider_accounts: {
                Row: {
                    agency_id: string
                    created_at: string | null
                    credentials_json: Json
                    id: string
                    is_default: boolean | null
                    kind: string
                    rate_limit_json: Json | null
                }
                Insert: {
                    agency_id: string
                    created_at?: string | null
                    credentials_json: Json
                    id?: string
                    is_default?: boolean | null
                    kind: string
                    rate_limit_json?: Json | null
                }
                Update: {
                    agency_id?: string
                    created_at?: string | null
                    credentials_json?: Json
                    id?: string
                    is_default?: boolean | null
                    kind?: string
                    rate_limit_json?: Json | null
                }
                Relationships: []
            }
            selection_batches: {
                Row: {
                    agency_id: string
                    created_at: string | null
                    created_by: string
                    deal_id: string
                    id: string
                    item_count: number | null
                    kind: Database["public"]["Enums"]["selection_kind"]
                    sent_at: string | null
                    status: Database["public"]["Enums"]["selection_status"]
                    summary: string | null
                }
                Insert: {
                    agency_id: string
                    created_at?: string | null
                    created_by?: string
                    deal_id: string
                    id?: string
                    item_count?: number | null
                    kind: Database["public"]["Enums"]["selection_kind"]
                    sent_at?: string | null
                    status?: Database["public"]["Enums"]["selection_status"]
                    summary?: string | null
                }
                Update: {
                    agency_id?: string
                    created_at?: string | null
                    created_by?: string
                    deal_id?: string
                    id?: string
                    item_count?: number | null
                    kind?: Database["public"]["Enums"]["selection_kind"]
                    sent_at?: string | null
                    status?: Database["public"]["Enums"]["selection_status"]
                    summary?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "selection_batches_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
            selection_events: {
                Row: {
                    contact_id: string
                    created_at: string | null
                    event: string
                    id: string
                    property_id: string | null
                    selection_id: string
                }
                Insert: {
                    contact_id: string
                    created_at?: string | null
                    event: string
                    id?: string
                    property_id?: string | null
                    selection_id: string
                }
                Update: {
                    contact_id?: string
                    created_at?: string | null
                    event?: string
                    id?: string
                    property_id?: string | null
                    selection_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "selection_events_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "selection_events_selection_id_fkey"
                        columns: ["selection_id"]
                        isOneToOne: false
                        referencedRelation: "selection_batches"
                        referencedColumns: ["id"]
                    },
                ]
            }
            selection_items: {
                Row: {
                    explanation: string | null
                    id: string
                    property_id: string
                    property_snapshot: Json | null
                    rank: number | null
                    selection_id: string
                }
                Insert: {
                    explanation?: string | null
                    id?: string
                    property_id: string
                    property_snapshot?: Json | null
                    rank?: number | null
                    selection_id: string
                }
                Update: {
                    explanation?: string | null
                    id?: string
                    property_id?: string
                    property_snapshot?: Json | null
                    rank?: number | null
                    selection_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "selection_items_selection_id_fkey"
                        columns: ["selection_id"]
                        isOneToOne: false
                        referencedRelation: "selection_batches"
                        referencedColumns: ["id"]
                    },
                ]
            }
            task_runs: {
                Row: {
                    agency_id: string | null
                    ai_task_id: string
                    finished_at: string | null
                    id: string
                    n8n_workflow_id: string | null
                    result_json: Json | null
                    run_id: string | null
                    started_at: string | null
                    status: string | null
                }
                Insert: {
                    agency_id?: string | null
                    ai_task_id: string
                    finished_at?: string | null
                    id?: string
                    n8n_workflow_id?: string | null
                    result_json?: Json | null
                    run_id?: string | null
                    started_at?: string | null
                    status?: string | null
                }
                Update: {
                    agency_id?: string | null
                    ai_task_id?: string
                    finished_at?: string | null
                    id?: string
                    n8n_workflow_id?: string | null
                    result_json?: Json | null
                    run_id?: string | null
                    started_at?: string | null
                    status?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "task_runs_ai_task_id_fkey"
                        columns: ["ai_task_id"]
                        isOneToOne: false
                        referencedRelation: "ai_tasks"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tasks: {
                Row: {
                    agency_id: string
                    assignee_id: string | null
                    contact_id: string
                    created_at: string | null
                    deal_id: string | null
                    due_at: string | null
                    id: string
                    reason: string | null
                    status: Database["public"]["Enums"]["task_status"]
                    title: string
                    updated_at: string | null
                }
                Insert: {
                    agency_id: string
                    assignee_id?: string | null
                    contact_id: string
                    created_at?: string | null
                    deal_id?: string | null
                    due_at?: string | null
                    id?: string
                    reason?: string | null
                    status?: Database["public"]["Enums"]["task_status"]
                    title: string
                    updated_at?: string | null
                }
                Update: {
                    agency_id?: string
                    assignee_id?: string | null
                    contact_id?: string
                    created_at?: string | null
                    deal_id?: string | null
                    due_at?: string | null
                    id?: string
                    reason?: string | null
                    status?: Database["public"]["Enums"]["task_status"]
                    title?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tasks_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "tasks_deal_id_fkey"
                        columns: ["deal_id"]
                        isOneToOne: false
                        referencedRelation: "deals"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            assign_deal: {
                Args: { p_agent_id: string; p_deal_id: string }
                Returns: undefined
            }
            generate_ai_tasks_for_deal:
            | {
                Args: {
                    p_agency_id: string
                    p_deal_id: string
                    p_template_id: string
                }
                Returns: undefined
            }
            | { Args: { p_deal_id: string }; Returns: undefined }
            handle_lead_event: {
                Args: { p_deal_id: string; p_event: string }
                Returns: undefined
            }
            has_elevated_role: { Args: { aid: string }; Returns: boolean }
            ingest_lead: {
                Args: {
                    p_agency_id: string
                    p_email: string
                    p_first_name: string
                    p_last_name: string
                    p_payload?: Json
                    p_phone: string
                    p_source: string
                    p_type: Database["public"]["Enums"]["deal_type"]
                }
                Returns: {
                    contact_id: string
                    deal_id: string
                }[]
            }
            is_agency_admin: { Args: { p_agency: string }; Returns: boolean }
            is_member_of_agency: { Args: { aid: string }; Returns: boolean }
            process_ai_tasks: { Args: never; Returns: undefined }
            show_limit: { Args: never; Returns: number }
            show_trgm: { Args: { "": string }; Returns: string[] }
        }
        Enums: {
            ai_action:
            | "send_whatsapp"
            | "call"
            | "send_email"
            | "wait"
            | "create_task"
            ai_mode_type: "manual" | "autopilot"
            ai_status:
            | "pending"
            | "queued"
            | "running"
            | "done"
            | "failed"
            | "canceled"
            deal_status:
            | "new"
            | "ai_contacting"
            | "ai_connected"
            | "qualified"
            | "viewing"
            | "offer"
            | "negotiation"
            | "won"
            | "lost"
            | "canceled"
            deal_type: "buy" | "rent" | "sell"
            location_type:
            | "COUNTRY"
            | "PROVINCE"
            | "MUNICIPALITY"
            | "AREA"
            | "NEIGHBOURHOOD"
            member_role: "admin" | "agent"
            property_feature_kind:
            | "CLIMATE_CONTROL"
            | "FEATURE"
            | "KITCHEN"
            | "LOCATION_TYPE"
            | "PARKING"
            | "POOL"
            | "SECURITY"
            | "VIEW"
            | "FURNITURE"
            property_status:
            | "ONLINE"
            | "BOOKED"
            | "SOLD"
            | "ARCHIVED"
            | "OFF_MARKET"
            | "UNKNOWN"
            | "TRASH"
            property_tag:
            | "EXCLUSIVE"
            | "SPANISH_GOLDEN_VISA"
            | "INVESTING_OPTIONS"
            | "NEW_DEVELOPMENT"
            | "ARCHIVED"
            | "FEATURED"
            | "PERFECT_INVESTMENT"
            | "HOLIDAY_HOME"
            | "LUXURY"
            property_type: "APARTMENT" | "COMPLEX" | "HOUSE"
            role_type:
            | "owner"
            | "admin"
            | "team_lead"
            | "agent"
            | "assistant"
            | "viewer"
            segment_type: "hot" | "not_now" | "cold"
            selection_kind: "hot" | "nurture" | "autopilot"
            selection_status:
            | "draft"
            | "needs_review"
            | "approved"
            | "sent"
            | "failed"
            task_status: "open" | "done" | "canceled"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    public: {
        Enums: {
            ai_action: ["send_whatsapp", "call", "send_email", "wait", "create_task"],
            ai_mode_type: ["manual", "autopilot"],
            ai_status: ["pending", "queued", "running", "done", "failed", "canceled"],
            deal_status: [
                "new",
                "ai_contacting",
                "ai_connected",
                "qualified",
                "viewing",
                "offer",
                "negotiation",
                "won",
                "lost",
                "canceled",
            ],
            deal_type: ["buy", "rent", "sell"],
            location_type: [
                "COUNTRY",
                "PROVINCE",
                "MUNICIPALITY",
                "AREA",
                "NEIGHBOURHOOD",
            ],
            member_role: ["admin", "agent"],
            property_feature_kind: [
                "CLIMATE_CONTROL",
                "FEATURE",
                "KITCHEN",
                "LOCATION_TYPE",
                "PARKING",
                "POOL",
                "SECURITY",
                "VIEW",
                "FURNITURE",
            ],
            property_status: [
                "ONLINE",
                "BOOKED",
                "SOLD",
                "ARCHIVED",
                "OFF_MARKET",
                "UNKNOWN",
                "TRASH",
            ],
            property_tag: [
                "EXCLUSIVE",
                "SPANISH_GOLDEN_VISA",
                "INVESTING_OPTIONS",
                "NEW_DEVELOPMENT",
                "ARCHIVED",
                "FEATURED",
                "PERFECT_INVESTMENT",
                "HOLIDAY_HOME",
                "LUXURY",
            ],
            property_type: ["APARTMENT", "COMPLEX", "HOUSE"],
            role_type: [
                "owner",
                "admin",
                "team_lead",
                "agent",
                "assistant",
                "viewer",
            ],
            segment_type: ["hot", "not_now", "cold"],
            selection_kind: ["hot", "nurture", "autopilot"],
            selection_status: ["draft", "needs_review", "approved", "sent", "failed"],
            task_status: ["open", "done", "canceled"],
        },
    },
} as const