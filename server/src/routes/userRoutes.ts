import { Router } from 'express';
import { userService } from '../services/userService';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', (req, res) => {
  try {
    const { username, password, role } = req.body;
    const result = userService.register({ username, password, role });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const result = userService.login({ username, password });
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/me', authenticate, (req: AuthRequest, res) => {
  const user = userService.getById(req.userId!);
  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json(user);
});

router.get('/users', authenticate, requireAdmin, (req, res) => {
  const users = userService.list();
  res.json(users);
});

export default router;
