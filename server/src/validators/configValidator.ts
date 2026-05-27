import { FormField, ValidationError, MAX_SUBFORM_DEPTH } from '../types';

export class ConfigValidator {
  private errors: ValidationError[] = [];

  validate(fields: FormField[], maxDepth: number = MAX_SUBFORM_DEPTH): ValidationError[] {
    this.errors = [];
    this.validateFields(fields, maxDepth, 0, []);
    return this.errors;
  }

  private validateFields(
    fields: FormField[],
    maxDepth: number,
    currentDepth: number,
    parentPath: string[]
  ): void {
    const keys = new Set<string>();

    fields.forEach((field, index) => {
      const fieldPath = [...parentPath, field.key || `field${index}`];

      if (!field.key || field.key.trim() === '') {
        this.errors.push({
          field: fieldPath.join('.'),
          message: '字段 key 不能为空'
        });
      } else if (keys.has(field.key)) {
        this.errors.push({
          field: fieldPath.join('.'),
          message: `字段 key 重复: ${field.key}`
        });
      } else {
        keys.add(field.key);
      }

      if (!field.title || field.title.trim() === '') {
        this.errors.push({
          field: fieldPath.join('.'),
          message: '字段标题不能为空'
        });
      }

      if (!field.type) {
        this.errors.push({
          field: fieldPath.join('.'),
          message: '字段类型不能为空'
        });
      }

      this.validateDefaultValue(field);
      this.validateOptions(field, fieldPath);
      this.validateLinkages(field, fields, fieldPath);
      this.validateValidationRules(field, fieldPath);

      if (field.type === 'subform') {
        if (currentDepth >= maxDepth) {
          this.errors.push({
            field: fieldPath.join('.'),
            message: `子表单嵌套层级过深，最大支持 ${maxDepth} 层`
          });
        }

        if (field.subFields && field.subFields.length > 0) {
          this.validateFields(field.subFields, maxDepth, currentDepth + 1, fieldPath);
        }
      }
    });
  }

  private validateDefaultValue(field: FormField): void {
    if (field.defaultValue === undefined || field.defaultValue === null) return;

    switch (field.type) {
      case 'number':
        if (typeof field.defaultValue !== 'number' && isNaN(Number(field.defaultValue))) {
          this.errors.push({
            field: field.key,
            message: `数字字段默认值类型不匹配: ${field.defaultValue}`
          });
        }
        break;
      case 'switch':
        if (typeof field.defaultValue !== 'boolean') {
          this.errors.push({
            field: field.key,
            message: `开关字段默认值必须是布尔值`
          });
        }
        break;
      case 'date':
        if (typeof field.defaultValue === 'string' && isNaN(Date.parse(field.defaultValue))) {
          this.errors.push({
            field: field.key,
            message: `日期字段默认值格式不正确`
          });
        }
        break;
      case 'select':
        if (field.options && !field.options.some(o => o.value === field.defaultValue)) {
          this.errors.push({
            field: field.key,
            message: `下拉字段默认值不在选项中: ${field.defaultValue}`
          });
        }
        break;
      case 'multiselect':
        if (Array.isArray(field.defaultValue) && field.options) {
          const optionValues = field.options.map(o => o.value);
          const invalidValues = field.defaultValue.filter((v: string) => !optionValues.includes(v));
          if (invalidValues.length > 0) {
            this.errors.push({
              field: field.key,
              message: `多选字段默认值包含无效选项: ${invalidValues.join(', ')}`
            });
          }
        }
        break;
    }
  }

  private validateOptions(field: FormField, fieldPath: string[]): void {
    if (['select', 'multiselect'].includes(field.type)) {
      if (!field.options || field.options.length === 0) {
        this.errors.push({
          field: fieldPath.join('.'),
          message: `${field.type === 'select' ? '下拉' : '多选'}字段必须配置选项`
        });
      } else {
        const values = new Set<string>();
        field.options.forEach((opt, idx) => {
          if (!opt.value || opt.value.trim() === '') {
            this.errors.push({
              field: `${fieldPath.join('.')}.options[${idx}]`,
              message: '选项值不能为空'
            });
          } else if (values.has(opt.value)) {
            this.errors.push({
              field: `${fieldPath.join('.')}.options[${idx}]`,
              message: `选项值重复: ${opt.value}`
            });
          } else {
            values.add(opt.value);
          }
          if (!opt.label || opt.label.trim() === '') {
            this.errors.push({
              field: `${fieldPath.join('.')}.options[${idx}]`,
              message: '选项标签不能为空'
            });
          }
        });
      }
    }
  }

  private validateLinkages(
    field: FormField,
    allFields: FormField[],
    fieldPath: string[]
  ): void {
    if (!field.linkages || field.linkages.length === 0) return;

    const fieldKeys = new Set(allFields.map(f => f.key));
    const linkageGraph = new Map<string, string[]>();

    field.linkages.forEach((rule, ruleIndex) => {
      rule.conditions.forEach((cond, condIndex) => {
        if (!cond.field) {
          this.errors.push({
            field: `${fieldPath.join('.')}.linkages[${ruleIndex}].conditions[${condIndex}]`,
            message: '联动条件字段不能为空'
          });
        } else if (!fieldKeys.has(cond.field)) {
          this.errors.push({
            field: `${fieldPath.join('.')}.linkages[${ruleIndex}].conditions[${condIndex}]`,
            message: `联动条件引用不存在的字段: ${cond.field}`
          });
        }
      });

      rule.actions.forEach((action, actionIndex) => {
        if (!action.target) {
          this.errors.push({
            field: `${fieldPath.join('.')}.linkages[${ruleIndex}].actions[${actionIndex}]`,
            message: '联动动作目标字段不能为空'
          });
        } else if (!fieldKeys.has(action.target)) {
          this.errors.push({
            field: `${fieldPath.join('.')}.linkages[${ruleIndex}].actions[${actionIndex}]`,
            message: `联动动作引用不存在的字段: ${action.target}`
          });
        }
      });

      const affectedTargets = rule.actions.map(a => a.target);
      affectedTargets.forEach(target => {
        if (!linkageGraph.has(field.key)) {
          linkageGraph.set(field.key, []);
        }
        linkageGraph.get(field.key)!.push(target);
      });
    });

    if (this.hasCycle(linkageGraph)) {
      this.errors.push({
        field: fieldPath.join('.'),
        message: '联动规则存在循环依赖'
      });
    }
  }

  private hasCycle(graph: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    function dfs(node: string): boolean {
      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  private validateValidationRules(field: FormField, fieldPath: string[]): void {
    if (!field.validationRules) return;

    field.validationRules.forEach((rule, index) => {
      switch (rule.type) {
        case 'minLength':
        case 'maxLength':
          if (typeof rule.value !== 'number' || rule.value < 0) {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '长度限制必须是非负整数'
            });
          }
          break;
        case 'min':
        case 'max':
          if (typeof rule.value !== 'number') {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '数值限制必须是数字'
            });
          }
          break;
        case 'pattern':
          if (typeof rule.value !== 'string') {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '正则表达式必须是字符串'
            });
          } else {
            try {
              new RegExp(rule.value);
            } catch {
              this.errors.push({
                field: `${fieldPath.join('.')}.validationRules[${index}]`,
                message: `无效的正则表达式: ${rule.value}`
              });
            }
          }
          break;
        case 'fileType':
          if (!Array.isArray(rule.value) || rule.value.length === 0) {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '文件类型限制必须是非空数组'
            });
          }
          break;
        case 'fileSize':
          if (typeof rule.value !== 'number' || rule.value <= 0) {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '文件大小限制必须是正整数'
            });
          }
          break;
        case 'minSelect':
        case 'maxSelect':
        case 'minRows':
        case 'maxRows':
          if (typeof rule.value !== 'number' || rule.value < 0) {
            this.errors.push({
              field: `${fieldPath.join('.')}.validationRules[${index}]`,
              message: '数量限制必须是非负整数'
            });
          }
          break;
      }
    });
  }
}

export const configValidator = new ConfigValidator();
