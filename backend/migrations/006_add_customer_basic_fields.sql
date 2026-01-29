ALTER TABLE opportunities
  ADD COLUMN company_name VARCHAR(255) NULL AFTER contact_wechat,
  ADD COLUMN company_phone VARCHAR(50) NULL AFTER company_name,
  ADD COLUMN company_email VARCHAR(100) NULL AFTER company_phone,
  ADD COLUMN contact_department VARCHAR(100) NULL AFTER company_email,
  ADD COLUMN contact_person VARCHAR(100) NULL AFTER contact_department,
  ADD COLUMN contact_address VARCHAR(255) NULL AFTER contact_person,
  ADD COLUMN website VARCHAR(255) NULL AFTER contact_address,
  ADD COLUMN country VARCHAR(100) NULL AFTER website,
  ADD COLUMN hall_no VARCHAR(50) NULL AFTER country,
  ADD COLUMN booth_no VARCHAR(50) NULL AFTER hall_no,
  ADD COLUMN booth_type VARCHAR(100) NULL AFTER booth_no,
  ADD COLUMN booth_area_sqm INT NULL AFTER booth_type;
