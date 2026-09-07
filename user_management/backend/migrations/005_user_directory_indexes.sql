CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_profiles_course_sem ON user_profiles(course, semester);
CREATE INDEX IF NOT EXISTS idx_profiles_dept_hostel ON user_profiles(department_id, hostel_id);
CREATE INDEX IF NOT EXISTS idx_profiles_roll ON user_profiles(roll_number);
