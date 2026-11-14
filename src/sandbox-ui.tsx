import { describeValue, formatValue } from './value-renderer';
import type { Signal } from './runtime';
export { describeValue, formatValue };
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
export { jsxRuntime };
import { createRoot } from 'react-dom/client';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
export { ReactDOM, ReactDOMClient };
import katex from 'katex';
import { Button } from './components/ui/button';
import { Slider } from './components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
export { React, createRoot, Button, Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
const formulaObservers = new WeakMap<HTMLElement, ResizeObserver>();
export function latex(element: HTMLElement, expression: string, { fontSize = 24 } = {}) {
  formulaObservers.get(element)?.disconnect();
  const viewport = document.createElement('div'), formula = document.createElement('div');
  viewport.className = 'math-viewport'; formula.className = 'math-content'; formula.style.fontSize = fontSize + 'px';
  formula.innerHTML = katex.renderToString(expression, { throwOnError: false, output: 'mathml', displayMode: true, trust: false });
  viewport.append(formula); element.replaceChildren(viewport);
  const fit = () => {
    const scale = Math.min(1, Math.max(1, viewport.clientWidth - 8) / Math.max(1, formula.scrollWidth), Math.max(1, viewport.clientHeight - 8) / Math.max(1, formula.scrollHeight));
    formula.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(viewport); observer.observe(formula); formulaObservers.set(element, observer); fit();
  return () => { observer.disconnect(); formulaObservers.delete(element); };
}

// Declarative bridges for mathematical rendering. Effects own their DOM resources.
export function Latex({ tex, fontSize = 24 }: { tex: string; fontSize?: number }) {
  const host = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => host.current ? latex(host.current, tex, { fontSize }) : undefined, [tex, fontSize]);
  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 40 }} />;
}
export function MathValue({ value, precision = 4, fontSize = 24, slice = 0 }: { value: Signal; precision?: number; fontSize?: number; slice?: number }) {
  const view = describeValue(value ?? null, slice);
  if (view.error) return <span>{view.error}</span>;
  if (view.kind === 'No signal') return <span>Connect an input</span>;
  if (!view.shape.length && view.kind !== 'Number') return <span style={{fontSize:16}}>{formatValue(value, precision)}</span>;
  const format = (item: Signal) => formatValue(item, precision);
  const tex = view.shape.length
    ? String.raw`\begin{bmatrix}${view.rows.map(row => row.map(format).join(' & ')).join(String.raw` \\ `)}\end{bmatrix}`
    : format(view.rows[0]?.[0]);
  return <Latex tex={tex} fontSize={fontSize}/>;
}

export class BlockRenderBoundary extends React.Component<{ children: React.ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
