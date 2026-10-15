import '@testing-library/jest-dom';

// ── Polyfills para componentes Radix em jsdom ──────────────────────────────
// Radix (Dialog/Select/Popper) usa APIs de layout que o jsdom não implementa.
// Sem isto, testes que renderizam dialogs explodem com "X is not a function".
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver);

if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView =
    window.HTMLElement.prototype.scrollIntoView ?? (() => {});
  const proto = window.HTMLElement.prototype;
  proto.hasPointerCapture = proto.hasPointerCapture ?? (() => false);
  proto.releasePointerCapture = proto.releasePointerCapture ?? (() => {});
  proto.setPointerCapture = proto.setPointerCapture ?? (() => {});
}
