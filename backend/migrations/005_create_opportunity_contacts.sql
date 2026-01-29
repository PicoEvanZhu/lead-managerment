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
