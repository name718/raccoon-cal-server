-- 浣熊卡路里数据库初始化脚本

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username)
);

-- 创建食物记录表
CREATE TABLE IF NOT EXISTS food_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  food_name VARCHAR(100) NOT NULL,
  calories DECIMAL(8,2) NOT NULL,
  protein DECIMAL(6,2),
  carbs DECIMAL(6,2),
  fat DECIMAL(6,2),
  image_url VARCHAR(255),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, recorded_at)
);

-- 创建虚拟宠物表
CREATE TABLE IF NOT EXISTS pets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  name VARCHAR(50) DEFAULT '小浣熊',
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  happiness INT DEFAULT 50,
  energy INT DEFAULT 100,
  last_fed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建任务表
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  task_type ENUM('daily', 'weekly', 'achievement') NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  target_value INT NOT NULL,
  current_value INT DEFAULT 0,
  reward_exp INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_type (user_id, task_type),
  INDEX idx_expires (expires_at)
);

-- 创建好友关系表
CREATE TABLE IF NOT EXISTS friendships (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  friend_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friendship (user_id, friend_id),
  INDEX idx_user_status (user_id, status)
);

-- 插入示例数据
INSERT INTO users (username, email, password_hash) VALUES
('demo_user', 'demo@example.com', '$2b$10$example_hash_here'),
('test_user', 'test@example.com', '$2b$10$example_hash_here');

-- 为示例用户创建宠物
INSERT INTO pets (user_id, name) VALUES
(1, '小浣熊'),
(2, '胖浣熊');

-- 创建示例任务
INSERT INTO tasks (user_id, task_type, title, description, target_value, reward_exp) VALUES
(1, 'daily', '记录三餐', '今天记录早中晚三餐', 3, 50),
(1, 'weekly', '坚持一周', '连续7天记录饮食', 7, 200),
(2, 'daily', '记录三餐', '今天记录早中晚三餐', 3, 50);
