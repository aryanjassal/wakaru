export function syncSystemTheme(): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(): void {
    document.documentElement.classList.toggle('dark', query.matches);
  }

  applyTheme();
  query.addEventListener('change', applyTheme);
  return () => query.removeEventListener('change', applyTheme);
}
