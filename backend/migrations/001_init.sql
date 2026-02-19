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

CREATE TABLE IF NOT EXISTS org_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(64) NULL,
  company_id BIGINT UNSIGNED NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_role_code (code),
  INDEX idx_org_role_scope (company_id, status),
  INDEX idx_org_role_name (name),
  CONSTRAINT fk_org_role_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_org_role_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_org_role_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS org_positions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(64) NULL,
  company_id BIGINT UNSIGNED NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_position_code (code),
  INDEX idx_org_position_scope (company_id, status),
  INDEX idx_org_position_name (name),
  CONSTRAINT fk_org_position_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_org_position_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_org_position_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_org_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  INDEX idx_user_org_role_role (role_id, user_id),
  CONSTRAINT fk_user_org_role_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_org_role_role FOREIGN KEY (role_id) REFERENCES org_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_org_positions (
  user_id BIGINT UNSIGNED NOT NULL,
  position_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, position_id),
  INDEX idx_user_org_position_position (position_id, user_id),
  CONSTRAINT fk_user_org_position_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_org_position_position FOREIGN KEY (position_id) REFERENCES org_positions(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS host_opportunity_pool_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_site VARCHAR(32) NOT NULL DEFAULT 'qufair',
  external_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  alias_name VARCHAR(255) NULL,
  industry VARCHAR(255) NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(100) NULL,
  organizer_name VARCHAR(255) NULL,
  venue_name VARCHAR(255) NULL,
  venue_address VARCHAR(255) NULL,
  exhibition_start_date DATE NULL,
  exhibition_end_date DATE NULL,
  cycle_text VARCHAR(100) NULL,
  exhibition_area_sqm INT NULL,
  exhibitors_count INT NULL,
  visitors_count INT NULL,
  heat_score INT NULL,
  source_url VARCHAR(500) NOT NULL,
  source_cover_url VARCHAR(500) NULL,
  source_list_url VARCHAR(500) NULL,
  is_domestic TINYINT(1) NOT NULL DEFAULT 1,
  pool_status ENUM('active', 'converted', 'archived') NOT NULL DEFAULT 'active',
  converted_opportunity_id BIGINT UNSIGNED NULL,
  raw_json LONGTEXT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_host_pool_source_external (source_site, external_id),
  UNIQUE KEY uniq_host_pool_source_url (source_url),
  INDEX idx_host_pool_status_date (pool_status, exhibition_start_date),
  INDEX idx_host_pool_city (city),
  INDEX idx_host_pool_industry (industry),
  CONSTRAINT fk_host_pool_converted_opp FOREIGN KEY (converted_opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS approval_form_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL,
  company_id BIGINT UNSIGNED NULL,
  schema_json LONGTEXT NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_form_tpl_company_status (company_id, status),
  INDEX idx_form_tpl_created_by (created_by),
  CONSTRAINT fk_form_tpl_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_form_tpl_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_form_tpl_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_process_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL,
  company_id BIGINT UNSIGNED NULL,
  form_template_id BIGINT UNSIGNED NOT NULL,
  steps_json LONGTEXT NOT NULL,
  current_version INT NOT NULL DEFAULT 1,
  published_version INT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'inactive',
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_proc_tpl_company_status (company_id, status),
  UNIQUE KEY uniq_proc_tpl_form_id (form_template_id),
  CONSTRAINT fk_proc_tpl_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_proc_tpl_form FOREIGN KEY (form_template_id) REFERENCES approval_form_templates(id),
  CONSTRAINT fk_proc_tpl_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_proc_tpl_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_process_template_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  process_template_id BIGINT UNSIGNED NOT NULL,
  version_no INT NOT NULL,
  form_template_id BIGINT UNSIGNED NOT NULL,
  definition_json LONGTEXT NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  updated_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_proc_tpl_version (process_template_id, version_no),
  INDEX idx_proc_tpl_version_status (process_template_id, status),
  CONSTRAINT fk_proc_tpl_ver_template FOREIGN KEY (process_template_id) REFERENCES approval_process_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_proc_tpl_ver_form FOREIGN KEY (form_template_id) REFERENCES approval_form_templates(id),
  CONSTRAINT fk_proc_tpl_ver_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_proc_tpl_ver_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_instances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  process_template_id BIGINT UNSIGNED NOT NULL,
  form_template_id BIGINT UNSIGNED NOT NULL,
  process_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  applicant_id BIGINT UNSIGNED NOT NULL,
  process_snapshot_json LONGTEXT NOT NULL,
  form_schema_json LONGTEXT NOT NULL,
  form_data_json LONGTEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 1,
  current_step_name VARCHAR(255) NULL,
  current_node_id VARCHAR(64) NULL,
  finished_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instance_status (status),
  INDEX idx_instance_applicant (applicant_id),
  INDEX idx_instance_company (company_id),
  INDEX idx_instance_process (process_template_id),
  CONSTRAINT fk_instance_process FOREIGN KEY (process_template_id) REFERENCES approval_process_templates(id),
  CONSTRAINT fk_instance_form FOREIGN KEY (form_template_id) REFERENCES approval_form_templates(id),
  CONSTRAINT fk_instance_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_instance_applicant FOREIGN KEY (applicant_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_instance_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT UNSIGNED NOT NULL,
  step_no INT NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  approval_mode ENUM('any', 'all') NOT NULL DEFAULT 'any',
  approver_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'waiting', 'approved', 'rejected', 'skipped') NOT NULL DEFAULT 'pending',
  decision ENUM('approve', 'reject') NULL,
  comment TEXT NULL,
  acted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_instance_step_approver (instance_id, step_no, approver_id),
  INDEX idx_task_instance_step (instance_id, step_no),
  INDEX idx_task_approver_status (approver_id, status),
  CONSTRAINT fk_task_instance FOREIGN KEY (instance_id) REFERENCES approval_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_approver FOREIGN KEY (approver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_instance_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  detail_json LONGTEXT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_instance_event_instance (instance_id, created_at),
  INDEX idx_instance_event_action (action),
  CONSTRAINT fk_instance_event_instance FOREIGN KEY (instance_id) REFERENCES approval_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_instance_event_task FOREIGN KEY (task_id) REFERENCES approval_instance_tasks(id) ON DELETE SET NULL,
  CONSTRAINT fk_instance_event_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_action_idempotency (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idem_key VARCHAR(128) NOT NULL,
  instance_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  response_json LONGTEXT NULL,
  status_code INT NOT NULL DEFAULT 200,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_action_idem (idem_key, instance_id, actor_id, action),
  INDEX idx_action_idem_created (created_at),
  CONSTRAINT fk_action_idem_instance FOREIGN KEY (instance_id) REFERENCES approval_instances(id) ON DELETE CASCADE,
  CONSTRAINT fk_action_idem_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
