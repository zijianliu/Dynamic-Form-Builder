import { Router } from 'express';
import { submissionService } from '../services/submissionService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, (req: AuthRequest, res) => {
  try {
    const { formId, versionId, data } = req.body;
    const submission = submissionService.submit(formId, versionId, data, req.userId!);
    res.json(submission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', authenticate, (req: AuthRequest, res) => {
  try {
    const { page, pageSize, formId, submittedBy, startDate, endDate } = req.query;
    const result = submissionService.list(
      {
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
        formId: formId as string,
        submittedBy: submittedBy as string,
        startDate: startDate as string,
        endDate: endDate as string
      },
      req.userId!,
      req.userRole === 'admin'
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', authenticate, (req: AuthRequest, res) => {
  try {
    const result = submissionService.getByIdWithVersion(req.params.id);
    if (!result) {
      res.status(404).json({ error: '提交记录不存在' });
      return;
    }

    if (req.userRole !== 'admin' && result.submission.submittedBy !== req.userId) {
      res.status(403).json({ error: '无权查看该提交记录' });
      return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
