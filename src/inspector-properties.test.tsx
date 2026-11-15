// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { defineInspectorProperty, parsePropertyField } from './inspector-properties';
import { InspectorProperties } from './components/inspector-properties';
import { makeNode, parseDiagram, serializeDiagram } from './model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('preserves tuned values across declarations and JSON, and validates definitions and values', () => {
  const node = makeNode('javascript', { x: 0, y: 0 });
  Object.assign(node.data, defineInspectorProperty(node.data, 'gain', { type: 'number', default: 2, min: 0, max: 10 }));
  node.data.parameters!.gain = 7;
  Object.assign(node.data, defineInspectorProperty(node.data, 'gain', { type: 'number', default: 3, min: 0, max: 10 }));
  expect(node.data.parameters!.gain).toBe(7);
  const diagram = { version: 1 as const, name: 'Parameters', nodes: [node], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  expect(parseDiagram(serializeDiagram(diagram)).nodes[0].data.parameters).toEqual({ gain: 7 });
  node.data.parameters!.gain = 11;
  expect(() => parseDiagram(serializeDiagram(diagram))).toThrow('parameter');
  Object.assign(node.data, defineInspectorProperty(node.data, 'gain', { type: 'number', default: 3, max: 5 }));
  expect(node.data.parameters!.gain).toBe(3);
  expect(() => defineInspectorProperty(node.data, '__proto__', { type: 'text', default: '' })).toThrow('name');
  expect(() => parsePropertyField({ type: 'select', options: ['a'], default: 'b' })).toThrow('default');
  expect(() => parsePropertyField({ type: 'number', default: 1, min: 10, max: 2 })).toThrow('range');
});

it('edits typed custom controls without locking them', async () => {
  let node = makeNode('javascript', { x: 0, y: 0 });
  for (const [name, field] of Object.entries({ gain: { type: 'number', label: 'Gain', default: 2, min: 0, max: 10 }, title: { type: 'text', default: 'Hello' }, enabled: { type: 'boolean', default: true }, mode: { type: 'select', default: 'Small', options: ['Small', 'Large'] }, accent: { type: 'color', default: '#1971c2' } })) Object.assign(node.data, defineInspectorProperty(node.data, name, field));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  function View() { const [data, setData] = useState(node.data); node = { ...node, data }; return createElement(InspectorProperties, { data, update: patch => setData(previous => ({ ...previous, ...patch })) }); }
  const input = async (label: string, value: string) => act(async () => { const element = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); });
  try {
    await act(async () => root.render(createElement(View)));
    await input('Gain', '6'); await input('title', 'Tuned');
    await act(async () => host.querySelector<HTMLInputElement>('[aria-label="enabled"]')!.click());
    await act(async () => { const select = host.querySelector<HTMLSelectElement>('[aria-label="mode"]')!; select.value = 'Large'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="accent #ffc9c9"]')!.click());
    expect(node.data.parameters).toEqual({ gain: 6, title: 'Tuned', enabled: false, mode: 'Large', accent: '#ffc9c9' });
    await input('Gain', '11'); expect(node.data.parameters!.gain).toBe(6);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
