import db from '../db';
import bcrypt from 'bcryptjs';
import { generateId } from '../utils/id';

const initTestData = () => {
  const now = new Date().toISOString();

  const adminId = generateId();
  const adminPassword = bcrypt.hashSync('admin123', 10);
  
  const userId = generateId();
  const userPassword = bcrypt.hashSync('user123', 10);

  const insertUserStmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAdminResult = insertUserStmt.run(
    adminId,
    'admin',
    adminPassword,
    'admin',
    now
  );

  const insertUserResult = insertUserStmt.run(
    userId,
    'user',
    userPassword,
    'user',
    now
  );

  console.log('✅ 测试数据初始化完成！');
  console.log('');
  console.log('👑 管理员账号：');
  console.log('   用户名：admin');
  console.log('   密码：admin123');
  console.log('');
  console.log('👤 普通用户账号：');
  console.log('   用户名：user');
  console.log('   密码：user123');
  console.log('');

  if (insertAdminResult.changes > 0) {
    console.log('✨ 管理员用户已创建');
  } else {
    console.log('ℹ️  管理员用户已存在');
  }

  if (insertUserResult.changes > 0) {
    console.log('✨ 普通用户已创建');
  } else {
    console.log('ℹ️  普通用户已存在');
  }
};

initTestData();
