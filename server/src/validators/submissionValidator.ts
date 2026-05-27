import { FormField, ValidationError, LinkageCondition, LinkageRule, OperatorType } from '../types';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../config';

export class SubmissionValidator {
  private errors: ValidationError[] = [];

  validate(
    data: Record<string, any>,
    fields: FormField[]
  ): ValidationError[] {
    this.errors = [];
    const fieldStates = this.computeFieldStates(fields, data);
    this.validateFields(data, fields, fieldStates, []);
    return this.errors;
  }

  private computeFieldStates(
    fields: FormField[],
    data: Record<string, any>
  ): Map<string, { visible: boolean; required: boolean; readOnly: boolean }> {
    const states = new Map<string, { visible: boolean; required: boolean; readOnly: boolean }>();

    fields.forEach(field => {
      states.set(field.key, {
        visible: !field.hidden,
        required: field.required || false,
        readOnly: field.readOnly || false
      });
    });

    fields.forEach(field => {
      if (field.linkages && field.linkages.length > 0) {
        field.linkages.forEach(rule => {
          if (this.evaluateConditions(rule.conditions, rule.logic, data)) {
            rule.actions.forEach(action => {
              const targetState = states.get(action.target);
              if (targetState) {
                switch (action.type) {
                  case 'show':
                    targetState.visible = true;
                    break;
                  case 'hide':
                    targetState.visible = false;
                    break;
                  case 'setRequired':
                    targetState.required = true;
                    break;
                  case 'setOptional':
                    targetState.required = false;
                    break;
                  case 'setReadOnly':
                    targetState.readOnly = true;
                    break;
                  case 'setEditable':
                    targetState.readOnly = false;
                    break;
                }
              }
            });
          }
        });
      }
    });

    return states;
  }

  private evaluateConditions(
    conditions: LinkageCondition[],
    logic: 'AND' | 'OR',
    data: Record<string, any>
  ): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map(cond => this.evaluateCondition(cond, data));

    if (logic === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  private evaluateCondition(
    condition: LinkageCondition,
    data: Record<string, any>
  ): boolean {
    const value = data[condition.field];

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
      case 'gte':
        return typeof value === 'number' && typeof condition.value === 'number' && value >= condition.value;
      case 'lt':
        return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
      case 'lte':
        return typeof value === 'number' && typeof condition.value === 'number' && value <= condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'empty':
        return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      case 'notEmpty':
        return value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0);
      default:
        return false;
    }
  }

  private validateFields(
    data: Record<string, any>,
    fields: FormField[],
    fieldStates: Map<string, { visible: boolean; required: boolean; readOnly: boolean }>,
    parentPath: string[]
  ): void {
    fields.forEach(field => {
      const fieldPath = [...parentPath, field.key];
      const state = fieldStates.get(field.key);

      if (state && !state.visible) {
        return;
      }

      const value = data[field.key];
      const isRequired = state?.required ?? field.required ?? false;

      if (isRequired) {
        if (this.isEmptyValue(value)) {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `${field.title}不能为空`
          });
          return;
        }
      }

      if (value === null || value === undefined || value === '') {
        return;
      }

      this.validateFieldValue(field, value, fieldPath);

      if (field.validationRules) {
        this.validateFieldRules(field, value, fieldPath);
      }

      if (field.type === 'subform' && Array.isArray(value)) {
        this.validateSubForm(field, value, fieldPath);
      }
    });
  }

  private isEmptyValue(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  private validateFieldValue(field: FormField, value: any, fieldPath: string[]): void {
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `${field.title}必须是数字`
          });
        }
        break;
      case 'date':
        if (typeof value === 'string' && isNaN(Date.parse(value))) {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `${field.title}日期格式不正确`
          });
        }
        break;
      case 'select':
        if (field.options && !field.options.some(o => o.value === value)) {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `${field.title}选项值无效: ${value}`
          });
        }
        break;
      case 'multiselect':
        if (Array.isArray(value) && field.options) {
          const optionValues = field.options.map(o => o.value);
          const invalidValues = value.filter((v: string) => !optionValues.includes(v));
          if (invalidValues.length > 0) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: `${field.title}包含无效选项: ${invalidValues.join(', ')}`
            });
          }
        }
        break;
      case 'switch':
        if (typeof value !== 'boolean') {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `${field.title}必须是布尔值`
          });
        }
        break;
      case 'file':
        if (typeof value === 'object' && value !== null) {
          if (value.size && value.size > MAX_FILE_SIZE) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: `${field.title}文件大小超过限制`
            });
          }
          if (value.mimetype && !ALLOWED_FILE_TYPES.includes(value.mimetype)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: `${field.title}文件类型不支持`
            });
          }
        }
        break;
      case 'address':
        if (typeof value === 'object') {
          if (!value.province && !value.city && !value.district && !value.detail) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: `${field.title}地址格式不正确`
            });
          }
        }
        break;
    }
  }

  private validateFieldRules(field: FormField, value: any, fieldPath: string[]): void {
    if (!field.validationRules) return;

    field.validationRules.forEach(rule => {
      switch (rule.type) {
        case 'minLength':
          if (typeof value === 'string' && value.length < (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}最少 ${rule.value} 个字符`
            });
          }
          break;
        case 'maxLength':
          if (typeof value === 'string' && value.length > (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}最多 ${rule.value} 个字符`
            });
          }
          break;
        case 'min':
          if (typeof value === 'number' && value < (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}不能小于 ${rule.value}`
            });
          }
          break;
        case 'max':
          if (typeof value === 'number' && value > (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}不能大于 ${rule.value}`
            });
          }
          break;
        case 'pattern':
          if (typeof value === 'string') {
            try {
              const regex = new RegExp(rule.value as string);
              if (!regex.test(value)) {
                this.errors.push({
                  field: fieldPath.join('.'),
                  message: rule.message || `${field.title}格式不正确`
                });
              }
            } catch {
            }
          }
          break;
        case 'minSelect':
          if (Array.isArray(value) && value.length < (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}至少选择 ${rule.value} 项`
            });
          }
          break;
        case 'maxSelect':
          if (Array.isArray(value) && value.length > (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}最多选择 ${rule.value} 项`
            });
          }
          break;
        case 'minRows':
          if (Array.isArray(value) && value.length < (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}至少添加 ${rule.value} 行`
            });
          }
          break;
        case 'maxRows':
          if (Array.isArray(value) && value.length > (rule.value as number)) {
            this.errors.push({
              field: fieldPath.join('.'),
              message: rule.message || `${field.title}最多添加 ${rule.value} 行`
            });
          }
          break;
      }
    });
  }

  private validateSubForm(field: FormField, rows: any[], fieldPath: string[]): void {
    if (!field.subFields || field.subFields.length === 0) return;

    rows.forEach((row, rowIndex) => {
      const rowPath = [...fieldPath, `[${rowIndex}]`];
      const subFieldStates = this.computeFieldStates(field.subFields!, row);

      field.subFields!.forEach(subField => {
        const subFieldPath = [...rowPath, subField.key];
        const state = subFieldStates.get(subField.key);

        if (state && !state.visible) {
          return;
        }

        const value = row[subField.key];
        const isRequired = state?.required ?? subField.required ?? false;

        if (isRequired && this.isEmptyValue(value)) {
          this.errors.push({
            field: subFieldPath.join('.'),
            message: `第 ${rowIndex + 1} 行 ${subField.title}不能为空`,
            rowIndex
          });
          return;
        }

        if (value === null || value === undefined || value === '') {
          return;
        }

        this.validateFieldValue(subField, value, subFieldPath);

        if (subField.validationRules) {
          this.validateFieldRules(subField, value, subFieldPath);
        }
      });
    });
  }
}

export const submissionValidator = new SubmissionValidator();
