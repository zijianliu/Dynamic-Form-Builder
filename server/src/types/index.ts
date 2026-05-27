export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'switch'
  | 'file'
  | 'address'
  | 'subform';

export type OperatorType =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in'
  | 'empty'
  | 'notEmpty';

export interface SelectOption {
  label: string;
  value: string;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'fileType' | 'fileSize' | 'minSelect' | 'maxSelect' | 'minRows' | 'maxRows';
  value?: number | string | string[];
  message?: string;
}

export interface LinkageCondition {
  field: string;
  operator: OperatorType;
  value?: string | number | boolean | string[] | number[];
}

export interface LinkageAction {
  type: 'show' | 'hide' | 'setRequired' | 'setOptional' | 'setReadOnly' | 'setEditable';
  target: string;
}

export interface LinkageRule {
  id: string;
  conditions: LinkageCondition[];
  logic: 'AND' | 'OR';
  actions: LinkageAction[];
}

export interface FormField {
  key: string;
  title: string;
  type: FieldType;
  defaultValue?: any;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  description?: string;
  order: number;
  options?: SelectOption[];
  validationRules?: ValidationRule[];
  linkages?: LinkageRule[];
  subFields?: FormField[];
  maxDepth?: number;
}

export interface FormConfig {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'disabled';
  fields: FormField[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormVersion {
  id: string;
  formId: string;
  version: number;
  fields: FormField[];
  configSnapshot: any;
  publishedAt: string;
  publishedBy: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  versionId: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  data: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ValidationError {
  field?: string;
  message: string;
  rowIndex?: number;
}
