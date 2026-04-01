// renderer/components/toast.js
// Shows temporary toast notifications at the bottom-right of the screen.
// Usage: import { show } from './toast.js'

const DURATION_MS = 3200;

/**
 * Shows a toast notification.
 * @param {string} message
 * @param {'success' | 'error' | 'info'} [type='info']
 */
export function show(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(el);

  setTimeout(() => dismiss(el), DURATION_MS);
}

/**
 * Animates a toast out and removes it from the DOM.
 * @param {HTMLElement} el
 */
function dismiss(el) {
  el.classList.add('is-leaving');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
