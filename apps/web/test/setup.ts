import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom implements neither of these, and both are load-bearing here: the game loop
 * runs on animation frames and the stage measures nothing else. Without them every
 * component test that mounts the loop hangs or throws.
 */
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    setTimeout(() => callback(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (handle: number): void => {
    clearTimeout(handle as unknown as NodeJS.Timeout);
  };
}

/**
 * jsdom implements no part of `<dialog>`.
 *
 * ui-sensibility §13 says to use the platform's own primitive for dialogs, which
 * every browser this game targets has. Rather than hand-rolling an overlay to suit
 * the test runner, the runner gets the two methods it is missing. This is a test
 * shim and nothing else — the shipped code calls the real thing.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ): void {
    this.removeAttribute('open');
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * The reduced-motion branch of every animated primitive is tested (ui-sensibility
 * §15), and jsdom's matchMedia returns nothing at all. Tests set the query result
 * through `setReducedMotion` rather than reaching into the mock.
 */
let reducedMotion = false;

export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

globalThis.matchMedia = vi.fn((query: string) => ({
  matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof globalThis.matchMedia;

afterEach(() => {
  cleanup();
  setReducedMotion(false);
});
