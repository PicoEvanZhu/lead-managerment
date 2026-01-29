ALTER TABLE opportunities
  ADD COLUMN exhibition_start_date DATE NULL,
  ADD COLUMN exhibition_end_date DATE NULL,
  ADD COLUMN venue_name VARCHAR(255),
  ADD COLUMN venue_address VARCHAR(255),
  ADD COLUMN booth_count INT,
  ADD COLUMN exhibition_area_sqm INT,
  ADD COLUMN expected_visitors INT,
  ADD COLUMN exhibition_theme VARCHAR(255),
  ADD COLUMN budget_range VARCHAR(100),
  ADD COLUMN risk_notes VARCHAR(255);
