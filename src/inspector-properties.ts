import type { BlockData } from './model';

export type PropertyValue = string | number | boolean;
export type PropertyField = {
  type: 'number' | 'text' | 'boolean' | 'color' | 'select';
  label?: string;
  default: PropertyValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
};
export const validPropertyName = (name: string) => /^[A-Za-z_$][\w$]{0,63}$/.test(name) && !['__proto__', 'prototype', 'constructor'].includes(name);
export function validPropertyValue(field: PropertyField, value: unknown): value is PropertyValue {
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
  if (field.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && value.length <= 10000 && (field.type !== 'color' || /^#[0-9a-f]{6}$/i.test(value)) && (field.type !== 'select' || !!field.options?.includes(value));
}
export function parsePropertyField(value: unknown): PropertyField {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid inspector property field.');
  const f = value as PropertyField;
  if (!['number', 'text', 'boolean', 'color', 'select'].includes(f.type) || (f.label !== undefined && (typeof f.label !== 'string' || f.label.length > 120))) throw new Error('Invalid inspector property type or label.');
  for (const key of ['min', 'max', 'step'] as const) if (f[key] !== undefined && (typeof f[key] !== 'number' || !Number.isFinite(f[key]))) throw new Error('Invalid inspector property bounds.');
  if ((f.step !== undefined && f.step <= 0) || (f.min !== undefined && f.max !== undefined && f.min > f.max)) throw new Error('Invalid inspector property range.');
  if (f.type === 'select' && (!Array.isArray(f.options) || !f.options.length || f.options.length > 100 || f.options.some(o => typeof o !== 'string' || o.length > 10000))) throw new Error('Invalid inspector property options.');
  if (!validPropertyValue(f, f.default)) throw new Error('Invalid inspector property default.');
  return { type: f.type, default: f.default, ...(f.label !== undefined ? { label: f.label } : {}), ...(f.type === 'number' ? { ...(f.min !== undefined ? { min: f.min } : {}), ...(f.max !== undefined ? { max: f.max } : {}), ...(f.step !== undefined ? { step: f.step } : {}) } : {}), ...(f.type === 'select' ? { options: [...f.options!] } : {}) };
}
export function parseInspectorProperties(data: Record<string, unknown>): Pick<BlockData, 'propertyFields' | 'parameters'> {
  const fields: Record<string, PropertyField> = {}, parameters: Record<string, PropertyValue> = {};
  if (data.propertyFields !== undefined) {
    if (!data.propertyFields || typeof data.propertyFields !== 'object' || Array.isArray(data.propertyFields) || Object.keys(data.propertyFields).length > 64) throw new Error('Invalid inspector property fields.');
    for (const [name, value] of Object.entries(data.propertyFields)) {
      if (!validPropertyName(name)) throw new Error('Invalid inspector property name.');
      fields[name] = parsePropertyField(value);
    }
  }
  if (data.parameters !== undefined) {
    if (!data.parameters || typeof data.parameters !== 'object' || Array.isArray(data.parameters) || Object.keys(data.parameters).length > 64) throw new Error('Invalid inspector parameters.');
    for (const [name, value] of Object.entries(data.parameters)) {
      if (!validPropertyName(name) || !Object.hasOwn(fields, name) || !validPropertyValue(fields[name], value)) throw new Error('Invalid inspector parameter value.');
      parameters[name] = value;
    }
  }
  return { ...(data.propertyFields !== undefined ? { propertyFields: fields } : {}), ...(data.parameters !== undefined ? { parameters } : {}) };
}
export function defineInspectorProperty(data: BlockData, name: string, definition: unknown): Partial<BlockData> {
  if (!validPropertyName(name)) throw new Error('Invalid inspector property name.');
  const field = parsePropertyField(definition);
  if (!Object.hasOwn(data.propertyFields ?? {}, name) && Object.keys(data.propertyFields ?? {}).length >= 64) throw new Error('At most 64 inspector properties are supported.');
  const current = data.parameters?.[name];
  return { propertyFields: { ...data.propertyFields, [name]: field }, parameters: { ...data.parameters, [name]: validPropertyValue(field, current) ? current : field.default } };
}
