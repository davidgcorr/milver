import { transform } from 'sucrase';
import type { BlockData } from './model';

export const defaultLogic = `async function run() {
  state.result = inputs.input1 ?? Number(value);
  emit(state.result);
}`;
export const defaultRender = `function render({ state, block }) {
  // state.result comes from run(); block contains the current block properties.
  const fontSize = defineProperty('fontSize', { type: 'number', label: 'Font size', default: 24, min: 10, max: 72 });
  return <div style={{ padding: 16, fontSize, textAlign: 'center' }}>
    <small style={{ display: 'block', fontSize: 11, opacity: 0.6 }}>{block.label}</small>
    <strong>{String(state.result ?? 'Connect an input')}</strong>
  </div>;
}`;
export const controlledPaths = ['label', 'description', 'value', 'width', 'height', 'visuals.background', 'visuals.foreground', 'visuals.radius', 'visuals.opacity', 'visuals.shadow', 'visuals.shadowColor', 'visuals.strokeWidth', 'visuals.strokeColor', 'visuals.showHeader', 'visuals.showLabel', 'visuals.showValue', 'visuals.showPortLabels'] as const;
export type ControlledPath = typeof controlledPaths[number];
export const isControlled = (data: BlockData, path: string) => data.controlledProperties?.includes(path as ControlledPath) ?? false;

export function completeFunction(source: string, name: 'run' | 'render'): string {
  if (new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source)) return source.trim().replace(/\bexport\s+(?:default\s+)?(?=(?:async\s+)?function\s+(?:run|render)\s*\()/, '');
  return `${name === 'run' || /\bawait\b/.test(source) ? 'async ' : ''}function ${name}() {\n${source.split('\n').map(line => '  ' + line).join('\n')}\n}`;
}
export function insertFunctionSnippet(source: string, snippet: string): string {
  const closing = source.lastIndexOf('}');
  return closing < 0 ? source + '\n' + snippet : source.slice(0, closing) + '\n' + snippet.split('\n').map(line => '  ' + line).join('\n') + '\n' + source.slice(closing);
}

// The lifecycle adapter stays out of the two user-editable function bodies.
export function buildBlockModule(logic: string, renderSource: string, renderEnabled = true): string {
  const runSource = completeFunction(logic, 'run');
  const drawSource = completeFunction(renderEnabled ? renderSource : 'function render() { return null; }', 'render');
  // Saved async/imperative renderers keep their lifecycle. New synchronous JSX
  // renderers are mounted as real React components, so hooks are valid.
  const component = !/\basync\s+function\s+render\s*\(/.test(drawSource)
    && (!/\belement\s*[.[]|\blatex\s*\(\s*element\b/.test(drawSource) || /<[A-Za-z>]|React\.createElement/.test(drawSource));
  const source = `export default async function mount(api) {
  let { inputs = {}, variables = {}, value } = api;
  const { element, state = {}, modules = {}, emit, emitEvent, setValue: persistValue, setProperty, wasm, ports, renderer } = api;
  let block = { ...api.block, value, state };
  const { React, Button, Slider, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Latex, MathValue, Iframe, BlockRenderBoundary, latex, describeValue, formatValue } = api.ui ?? {};
  const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } = React ?? {};
  const actions = {};
  let rerun = false;
  const pendingValues = new Set();
  const key = value => JSON.stringify(value, (_,x) => typeof x === 'number' && !Number.isFinite(x) ? String(x) : x);
  const properties = ({state,value,...rest} = {}) => rest;
  let reactRoot, cleanup, disposed = false, executing = false, queued = false, renderedDuringRun = false;
  let disposers = [];
  const onCleanup = fn => disposers.push(fn);
  const setValue = next => {
    if (typeof next !== 'string' || next === value) return;
    value = next; block = { ...block, value }; pendingValues.add(next); if(pendingValues.size>64)pendingValues.delete(pendingValues.values().next().value); persistValue?.(next);
    if (executing) rerun = true;
    else void execute().catch(error => api.reportError?.(error));
  };
  const setState = patch => { const next = typeof patch === 'function' ? patch(state) : patch; Object.assign(state, next); requestRender(); };
  const declaredProperties = new Map();
  const defineProperty = (name, options) => {
    if (!/^[A-Za-z_$][\\w$]{0,63}$/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Invalid inspector property name.');
    const definition = JSON.stringify(options);
    if (declaredProperties.get(name) !== definition) {
      declaredProperties.set(name, definition);
      setProperty?.('propertyFields.' + name, options);
    }
    return Object.hasOwn(block.parameters ?? {}, name) ? block.parameters[name] : options.default;
  };
  const scope = () => ({ ...api.ui, element, wasm, inputs, variables, value, state, setState, block, modules, actions, emit, emitEvent, setValue, setProperty, defineProperty, onCleanup, render, renderer, ports });
  const View = (${drawSource});
  ${runSource}
  async function render() {
    if (disposed) return;
    if (executing) renderedDuringRun = true;
    if (${component}) {
      if (!React || !api.ui?.createRoot) throw new Error('React rendering is not available.');
      reactRoot ??= api.ui.createRoot(element, api.reportError ? { onUncaughtError: error => queueMicrotask(() => api.reportError(error)) } : undefined);
      const component = React.createElement(View, scope());
      reactRoot.render(BlockRenderBoundary ? React.createElement(BlockRenderBoundary, { onError: error => queueMicrotask(() => api.reportError?.(error)) }, component) : component);
    } else {
      if (typeof cleanup === 'function') await cleanup();
      const result = await View(scope());
      if (React?.isValidElement(result) || Array.isArray(result)) {
        reactRoot ??= api.ui.createRoot(element);
        reactRoot.render(result);
      } else cleanup = result;
    }
  }
  function requestRender() {
    if (disposed || executing || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) Promise.resolve(render()).catch(error => api.reportError?.(error)); });
  }
  const unsubscribe = ${component} ? api.subscribeState?.(requestRender) : undefined;
  async function execute() {
    if (disposed) return;
    if (executing) { rerun = true; return; }
    do { rerun = false;
    executing = true; renderedDuringRun = false;
    try {
      for (const dispose of disposers.splice(0)) await dispose();
      await run(scope());
    } finally { executing = false; }
    if (${component} || !renderedDuringRun) await render();
    } while (rerun && !disposed);
  }
  try { await execute(); }
  catch (error) { disposed = true; unsubscribe?.(); reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); throw error; }
  return {
    async update(nextInputs, nextValue, nextVariables, nextBlock) {
      if(pendingValues.has(nextValue)) {
        pendingValues.delete(nextValue);
        nextValue = value;
        if(key(nextInputs)===key(inputs) && key(nextVariables??{})===key(variables) && (!nextBlock || key(properties(nextBlock))===key(properties(block)))) return;
      }
      inputs = nextInputs; value = nextValue; variables = nextVariables ?? {};
      block = { ...block, ...nextBlock, value, state };
      await execute();
    },
    async invokeAction(name, args = []) { if (!Object.hasOwn(actions, name) || typeof actions[name] !== 'function') throw new Error('Unknown block action: ' + name); return await actions[name](...args); },
    inspect() { return { inputs, value, state, block, actions: Object.keys(actions) }; },
    async destroy() { disposed = true; unsubscribe?.(); reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); if (typeof cleanup === 'function') await cleanup(); }
  };
}`;
  return transform(source, { transforms: ['jsx'], jsxRuntime: 'classic', production: true, disableESTransforms: true }).code;
}
