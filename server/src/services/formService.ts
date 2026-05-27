import db from '../db';
import { generateId } from '../utils/id';
import { FormField, FormConfig, FormVersion, PaginatedResult, FormSubmission } from '../types';
import { configValidator } from '../validators/configValidator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config';

export interface CreateFormInput {
  name: string;
  description?: string;
  fields: FormField[];
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  fields?: FormField[];
}

export interface ListFormsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export class FormService {
  create(input: CreateFormInput, userId: string): FormConfig {
    const errors = configValidator.validate(input.fields);
    if (errors.length > 0) {
      throw new Error(`配置校验失败: ${errors.map(e => e.message).join('; ')}`);
    }

    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO form_configs (id, name, description, status, fields, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
    ).run(id, input.name, input.description || null, JSON.stringify(input.fields), userId, userId, now, now);

    return this.getById(id)!;
  }

  update(id: string, input: UpdateFormInput, userId: string): FormConfig {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    if (form.status === 'published') {
      throw new Error('已发布的表单不能直接修改，请先停用');
    }

    if (input.fields) {
      const errors = configValidator.validate(input.fields);
      if (errors.length > 0) {
        throw new Error(`配置校验失败: ${errors.map(e => e.message).join('; ')}`);
      }
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      params.push(input.description);
    }
    if (input.fields !== undefined) {
      updates.push('fields = ?');
      params.push(JSON.stringify(input.fields));
    }
    updates.push('updated_by = ?');
    params.push(userId);
    updates.push('updated_at = ?');
    params.push(now);

    params.push(id);

    db.prepare(`UPDATE form_configs SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id)!;
  }

  copy(id: string, userId: string): FormConfig {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    const newId = generateId();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO form_configs (id, name, description, status, fields, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
    ).run(newId, `${form.name} (副本)`, form.description, JSON.stringify(form.fields), userId, userId, now, now);

    return this.getById(newId)!;
  }

  publish(id: string, userId: string): FormVersion {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    if (form.fields.length === 0) {
      throw new Error('表单没有配置字段，不能发布');
    }

    const versionId = generateId();
    const version = form.currentVersion + 1;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO form_versions (id, form_id, version, fields, config_snapshot, published_at, published_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId,
        id,
        version,
        JSON.stringify(form.fields),
        JSON.stringify({ name: form.name, description: form.description }),
        now,
        userId
      );

      db.prepare(
        'UPDATE form_configs SET status = ?, current_version = ?, updated_by = ?, updated_at = ? WHERE id = ?'
      ).run('published', version, userId, now, id);
    });

    tx();

    return this.getVersionById(versionId)!;
  }

  disable(id: string, userId: string): FormConfig {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE form_configs SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?'
    ).run('disabled', userId, now, id);

    return this.getById(id)!;
  }

  enable(id: string, userId: string): FormConfig {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    if (form.currentVersion === 0) {
      throw new Error('表单还没有发布过，不能启用');
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE form_configs SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?'
    ).run('published', userId, now, id);

    return this.getById(id)!;
  }

  delete(id: string): void {
    const form = this.getById(id);
    if (!form) {
      throw new Error('表单不存在');
    }

    const submissions = db.prepare(
      'SELECT COUNT(*) as count FROM form_submissions WHERE form_id = ?'
    ).get(id) as { count: number };

    if (submissions.count > 0) {
      throw new Error('该表单已有提交记录，不能删除');
    }

    db.prepare('DELETE FROM form_configs WHERE id = ?').run(id);
  }

  getById(id: string): FormConfig | undefined {
    const row = db.prepare('SELECT * FROM form_configs WHERE id = ?').get(id);
    if (!row) return undefined;
    return this.mapFormConfig(row as any);
  }

  list(query: ListFormsQuery): PaginatedResult<FormConfig> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(query.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params: any[] = [];

    if (query.search) {
      whereClause += 'WHERE name LIKE ?';
      params.push(`%${query.search}%`);
    }

    if (query.status) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' status = ?';
      params.push(query.status);
    }

    const total = (db.prepare(
      `SELECT COUNT(*) as count FROM form_configs ${whereClause}`
    ).get(...params) as { count: number }).count;

    const rows = db.prepare(
      `SELECT * FROM form_configs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return {
      data: (rows as any[]).map(row => this.mapFormConfig(row)),
      total,
      page,
      pageSize
    };
  }

  getVersions(formId: string): FormVersion[] {
    const rows = db.prepare(
      'SELECT * FROM form_versions WHERE form_id = ? ORDER BY version DESC'
    ).all(formId);

    return (rows as any[]).map(row => this.mapFormVersion(row));
  }

  getVersionById(id: string): FormVersion | undefined {
    const row = db.prepare('SELECT * FROM form_versions WHERE id = ?').get(id);
    if (!row) return undefined;
    return this.mapFormVersion(row as any);
  }

  getLatestVersion(formId: string): FormVersion | undefined {
    const row = db.prepare(
      'SELECT * FROM form_versions WHERE form_id = ? ORDER BY version DESC LIMIT 1'
    ).get(formId);
    if (!row) return undefined;
    return this.mapFormVersion(row as any);
  }

  private mapFormConfig(row: any): FormConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      fields: JSON.parse(row.fields),
      currentVersion: row.current_version,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapFormVersion(row: any): FormVersion {
    return {
      id: row.id,
      formId: row.form_id,
      version: row.version,
      fields: JSON.parse(row.fields),
      configSnapshot: JSON.parse(row.config_snapshot),
      publishedAt: row.published_at,
      publishedBy: row.published_by
    };
  }
}

export const formService = new FormService();
