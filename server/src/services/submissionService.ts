import db from '../db';
import { generateId } from '../utils/id';
import { FormSubmission, PaginatedResult, FormVersion } from '../types';
import { submissionValidator } from '../validators/submissionValidator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config';

export interface ListSubmissionsQuery {
  page?: number;
  pageSize?: number;
  formId?: string;
  submittedBy?: string;
  startDate?: string;
  endDate?: string;
}

export class SubmissionService {
  submit(
    formId: string,
    versionId: string,
    data: Record<string, any>,
    userId: string
  ): FormSubmission {
    const form = db.prepare('SELECT * FROM form_configs WHERE id = ?').get(formId) as any;
    if (!form) {
      throw new Error('表单不存在');
    }

    if (form.status !== 'published') {
      throw new Error('表单未发布或已停用，不能提交');
    }

    const version = db.prepare('SELECT * FROM form_versions WHERE id = ?').get(versionId) as any;
    if (!version) {
      throw new Error('表单版本不存在');
    }

    if (version.form_id !== formId) {
      throw new Error('表单版本与表单不匹配');
    }

    if (version.version !== form.current_version) {
      throw new Error('表单配置已更新，请刷新页面后重新填写');
    }

    const fields = JSON.parse(version.fields);
    const errors = submissionValidator.validate(data, fields);

    if (errors.length > 0) {
      throw new Error(`数据校验失败: ${errors.map(e => e.message).join('; ')}`);
    }

    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO form_submissions (id, form_id, version_id, version, submitted_by, submitted_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, formId, versionId, version.version, userId, now, JSON.stringify(this.sanitizeData(data, fields)));

    return this.getById(id)!;
  }

  getById(id: string): FormSubmission | undefined {
    const row = db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(id);
    if (!row) return undefined;
    return this.mapSubmission(row as any);
  }

  getByIdWithVersion(id: string): { submission: FormSubmission; version: FormVersion } | undefined {
    const submission = db.prepare('SELECT * FROM form_submissions WHERE id = ?').get(id) as any;
    if (!submission) return undefined;

    const version = db.prepare('SELECT * FROM form_versions WHERE id = ?').get(submission.version_id) as any;
    if (!version) return undefined;

    return {
      submission: this.mapSubmission(submission),
      version: {
        id: version.id,
        formId: version.form_id,
        version: version.version,
        fields: JSON.parse(version.fields),
        configSnapshot: JSON.parse(version.config_snapshot),
        publishedAt: version.published_at,
        publishedBy: version.published_by
      }
    };
  }

  list(
    query: ListSubmissionsQuery,
    userId: string,
    isAdmin: boolean
  ): PaginatedResult<FormSubmission & { formName: string }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(query.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: any[] = [];

    if (!isAdmin) {
      whereClause += 'WHERE s.submitted_by = ?';
      params.push(userId);
    }

    if (query.formId) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' s.form_id = ?';
      params.push(query.formId);
    }

    if (query.submittedBy && isAdmin) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' s.submitted_by = ?';
      params.push(query.submittedBy);
    }

    if (query.startDate) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' s.submitted_at >= ?';
      params.push(query.startDate);
    }

    if (query.endDate) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' s.submitted_at <= ?';
      params.push(query.endDate);
    }

    const total = (db.prepare(
      `SELECT COUNT(*) as count FROM form_submissions s ${whereClause}`
    ).get(...params) as { count: number }).count;

    const rows = db.prepare(
      `SELECT s.*, f.name as form_name
       FROM form_submissions s
       LEFT JOIN form_configs f ON s.form_id = f.id
       ${whereClause}
       ORDER BY s.submitted_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return {
      data: (rows as any[]).map(row => ({
        ...this.mapSubmission(row),
        formName: row.form_name
      })),
      total,
      page,
      pageSize
    };
  }

  getRecentByFormId(formId: string, limit: number = 10): FormSubmission[] {
    const rows = db.prepare(
      `SELECT * FROM form_submissions WHERE form_id = ? ORDER BY submitted_at DESC LIMIT ?`
    ).all(formId, limit);

    return (rows as any[]).map(row => this.mapSubmission(row));
  }

  private sanitizeData(
    data: Record<string, any>,
    fields: any[]
  ): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const fieldKeys = new Set(fields.map(f => f.key));

    for (const key of Object.keys(data)) {
      if (fieldKeys.has(key)) {
        sanitized[key] = data[key];
      }
    }

    return sanitized;
  }

  private mapSubmission(row: any): FormSubmission {
    return {
      id: row.id,
      formId: row.form_id,
      versionId: row.version_id,
      version: row.version,
      submittedBy: row.submitted_by,
      submittedAt: row.submitted_at,
      data: JSON.parse(row.data)
    };
  }
}

export const submissionService = new SubmissionService();
