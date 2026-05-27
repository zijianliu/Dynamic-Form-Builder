import { Router } from 'express';
import { formService } from '../services/formService';
import { submissionService } from '../services/submissionService';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const { name, description, fields } = req.body;
    const form = formService.create({ name, description, fields }, req.userId!);
    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const { page, pageSize, search, status } = req.query;
    const result = formService.list({
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      search: search as string,
      status: status as string
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/published', authenticate, (req, res) => {
  try {
    const result = formService.list({ status: 'published' });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', authenticate, (req: AuthRequest, res) => {
  try {
    const form = formService.getById(req.params.id);
    if (!form) {
      res.status(404).json({ error: '表单不存在' });
      return;
    }

    if (req.userRole !== 'admin' && form.status !== 'published') {
      res.status(403).json({ error: '无权查看该表单' });
      return;
    }

    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const { name, description, fields } = req.body;
    const form = formService.update(req.params.id, { name, description, fields }, req.userId!);
    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/copy', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const form = formService.copy(req.params.id, req.userId!);
    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/publish', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const version = formService.publish(req.params.id, req.userId!);
    res.json(version);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/disable', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const form = formService.disable(req.params.id, req.userId!);
    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/enable', authenticate, requireAdmin, (req: AuthRequest, res) => {
  try {
    const form = formService.enable(req.params.id, req.userId!);
    res.json(form);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    formService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/versions', authenticate, (req, res) => {
  try {
    const versions = formService.getVersions(req.params.id);
    res.json(versions);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/latest-version', authenticate, (req: AuthRequest, res) => {
  try {
    const form = formService.getById(req.params.id);
    if (!form) {
      res.status(404).json({ error: '表单不存在' });
      return;
    }

    if (req.userRole !== 'admin' && form.status !== 'published') {
      res.status(403).json({ error: '无权查看该表单' });
      return;
    }

    const version = formService.getLatestVersion(req.params.id);
    if (!version) {
      res.status(404).json({ error: '没有找到发布版本' });
      return;
    }
    res.json(version);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/submissions/recent', authenticate, (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const submissions = submissionService.getRecentByFormId(req.params.id, limit);
    res.json(submissions);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
