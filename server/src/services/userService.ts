import db from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';
import { generateId } from '../utils/id';
import { User } from '../types';

export interface RegisterInput {
  username: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface LoginInput {
  username: string;
  password: string;
}

export class UserService {
  register(input: RegisterInput): { token: string; user: Omit<User, 'password'> } {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(input.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const id = generateId();
    const hashedPassword = bcrypt.hashSync(input.password, 10);
    const now = new Date().toISOString();
    const role = input.role || 'user';

    db.prepare(
      'INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.username, hashedPassword, role, now);

    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const user = { id, username: input.username, role, createdAt: now };

    return { token, user };
  }

  login(input: LoginInput): { token: string; user: Omit<User, 'password'> } {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(input.username) as User | undefined;

    if (!user || !bcrypt.compareSync(input.password, user.password)) {
      throw new Error('用户名或密码错误');
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const { password, ...userWithoutPassword } = user;

    return { token, user: userWithoutPassword };
  }

  getById(id: string): Omit<User, 'password'> | undefined {
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
    return user as Omit<User, 'password'> | undefined;
  }

  list(): Omit<User, 'password'>[] {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
    return users as Omit<User, 'password'>[];
  }
}

export const userService = new UserService();
