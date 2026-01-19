-- Insert missing features found in Resales Online logs
-- using ON CONFLICT to avoid duplicates if they already exist

INSERT INTO features (key, name, "nameResale") VALUES
-- Utilities
('utilities_electricity', 'Electricity', 'Electricity'),
('utilities_drinkable_water', 'Drinkable Water', 'Drinkable Water'),
('utilities_telephone', 'Telephone', 'Telephone'),
('utilities_gas', 'Gas', 'Gas'),

-- Orientation
('orientation_north', 'North', 'North'),
('orientation_south', 'South', 'South'),
('orientation_east', 'East', 'East'),
('orientation_west', 'West', 'West'),
('orientation_north_east', 'North East', 'North East'),
('orientation_north_west', 'North West', 'North West'),
('orientation_south_east', 'South East', 'South East'),
('orientation_south_west', 'South West', 'South West'),

-- Categories
('category_investment', 'Investment', 'Investment'),
('category_bargain', 'Bargain', 'Bargain'),
('category_holiday_homes', 'Holiday Homes', 'Holiday Homes'),
('category_distressed', 'Distressed', 'Distressed'),
('category_reduced', 'Reduced', 'Reduced'),
('category_cheap', 'Cheap', 'Cheap'),
('category_resale', 'Resale', 'Resale'),
('category_luxury', 'Luxury', 'Luxury'),
('category_off_plan', 'Off Plan', 'Off Plan'),
('category_contemporary', 'Contemporary', 'Contemporary'),

-- Condition
('condition_renovation_required', 'Renovation Required', 'Renovation Required'),
('condition_restoration_required', 'Restoration Required', 'Restoration Required'),
('condition_fair', 'Fair', 'Fair'),
('condition_good', 'Good', 'Good'),
('condition_excellent', 'Excellent', 'Excellent'),
('condition_recently_renovated', 'Recently Renovated', 'Recently Renovated'),
('condition_recently_refurbished', 'Recently Refurbished', 'Recently Refurbished'),
('condition_new_construction', 'New Construction', 'New Construction'),

-- Views
('view_mountain', 'Mountain', 'Mountain'),
('view_panoramic', 'Panoramic', 'Panoramic'),
('view_sea', 'Sea', 'Sea'),
('view_country', 'Country', 'Country'),
('view_garden', 'Garden', 'Garden'),
('view_pool', 'Pool', 'Pool'),
('view_urban', 'Urban', 'Urban'),
('view_street', 'Street', 'Street'),

-- Setting
('setting_village', 'Village', 'Village'),
('setting_town', 'Town', 'Town'),
('setting_suburban', 'Suburban', 'Suburban'),
('setting_country', 'Country', 'Country'),
('setting_commercial_area', 'Commercial Area', 'Commercial Area'),
('setting_beachside', 'Beachside', 'Beachside'),
('setting_mountain_pueblo', 'Mountain Pueblo', 'Mountain Pueblo'),
('setting_close_to_golf', 'Close To Golf', 'Close To Golf'),
('setting_close_to_port', 'Close To Port', 'Close To Port'),
('setting_close_to_shops', 'Close To Shops', 'Close To Shops'),
('setting_close_to_sea', 'Close To Sea', 'Close To Sea'),
('setting_close_to_town', 'Close To Town', 'Close To Town'),
('setting_close_to_schools', 'Close To Schools', 'Close To Schools'),
('setting_urbanisation', 'Urbanisation', 'Urbanisation'),

-- Parking
('parking_open', 'Open', 'Open'),
('parking_underground', 'Underground', 'Underground'),
('parking_garage', 'Garage', 'Garage'),
('parking_street', 'Street', 'Street'),
('parking_private', 'Private', 'Private'),
('parking_communal', 'Communal', 'Communal')

ON CONFLICT (key) DO UPDATE SET "nameResale" = EXCLUDED."nameResale";
