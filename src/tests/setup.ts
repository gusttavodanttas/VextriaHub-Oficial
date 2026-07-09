import '@testing-library/jest-dom';

// ── Polyfills para componentes Radix em jsdom ──────────────────────────────
// Radix (Dialog/Select/Popper) usa APIs de layout que o jsdom não implementa.
// Sem isto, testes que renderizam dialogs explodem com "X is not a function".
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? ResizeObserverStub;

if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView =
    window.HTMLElement.prototype.scrollIntoView ?? (() => {});
  (window.HTMLElement.prototype as any).hasPointerCapture =
    (window.HTMLElement.prototype as any).hasPointerCapture ?? (() => false);
  (window.HTMLElement.prototype as any).releasePointerCapture =
    (window.HTMLElement.prototype as any).releasePointerCapture ?? (() => {});
  (window.HTMLElement.prototype as any).setPointerCapture =
    (window.HTMLElement.prototype as any).setPointerCapture ?? (() => {});
}
