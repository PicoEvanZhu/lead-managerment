CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) UNIQUE,
  parent_id BIGINT UNSIGNED NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  CONSTRAINT fk_companies_parent FOREIGN KEY (parent_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role ENUM('group_admin', 'subsidiary_admin', 'sales', 'marketing') NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  password_hash VARCHAR(255),
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_company (company_id),
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('normal', 'host') NOT NULL,
  source VARCHAR(100) NOT NULL,
  industry VARCHAR(100),
  city VARCHAR(100),
  status ENUM('new', 'assigned', 'in_progress', 'valid', 'invalid') NOT NULL DEFAULT 'new',
  stage ENUM('cold', 'interest', 'need_defined', 'bid_preparing', 'ready_for_handoff') NOT NULL DEFAULT 'cold',
  owner_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  organizer_name VARCHAR(255),
  organizer_type ENUM('foreign', 'state_owned', 'gov_joint', 'government', 'commercial') NULL,
  exhibition_name VARCHAR(255),
  exhibition_start_date DATE NULL,
  exhibition_end_date DATE NULL,
  venue_name VARCHAR(255),
  venue_address VARCHAR(255),
  booth_count INT,
  exhibition_area_sqm INT,
  expected_visitors INT,
  exhibition_theme VARCHAR(255),
  budget_range VARCHAR(100),
  risk_notes VARCHAR(255),
  contact_name VARCHAR(100),
  contact_title VARCHAR(100),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(100),
  contact_wechat VARCHAR(100),
  invalid_reason VARCHAR(255),
  last_follow_up_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_status (company_id, status),
  INDEX idx_company_stage (company_id, stage),
  INDEX idx_owner (owner_id),
  CONSTRAINT fk_opportunities_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT fk_opportunities_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_insights (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  analysis_json LONGTEXT,
  contacts_json LONGTEXT,
  sources_json LONGTEXT,
  provider VARCHAR(50),
  model VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_opportunity (opportunity_id),
  CONSTRAINT fk_insights_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('phone', 'email', 'wechat', 'onsite', 'other') NOT NULL,
  result VARCHAR(255),
  next_step VARCHAR(255),
  follow_up_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunity (opportunity_id),
  CONSTRAINT fk_activities_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100),
  title VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(100),
  wechat VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunity (opportunity_id),
  CONSTRAINT fk_contacts_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  type ENUM('city', 'industry', 'status', 'business', 'custom') NOT NULL DEFAULT 'custom',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tag (name, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_tags (
  opportunity_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (opportunity_id, tag_id),
  CONSTRAINT fk_opp_tags_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
