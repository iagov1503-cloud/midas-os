(() => {
 'use strict';
 const key = 'midas-theme';
 let theme = 'light';
 try { const saved = localStorage.getItem(key); if (saved === 'dark' || saved === 'light') theme = saved; } catch {}
 const apply = () => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const button = document.getElementById('themeToggle');
  if (button) {
   button.textContent = theme === 'dark' ? '☀ Modo claro' : '☾ Modo escuro';
   button.setAttribute('aria-pressed', String(theme === 'dark'));
   button.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
  }
 };
 apply();
 document.addEventListener('DOMContentLoaded', () => {
  apply();
  document.getElementById('themeToggle')?.addEventListener('click', () => {
   theme = theme === 'dark' ? 'light' : 'dark';
   try { localStorage.setItem(key, theme); } catch {}
   apply();
  });
 });
 window.addEventListener('storage', event => {
  if (event.key === key) { theme = event.newValue === 'dark' ? 'dark' : 'light'; apply(); }
 });
})();
