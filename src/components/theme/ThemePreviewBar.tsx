'use client';

export function ThemePreviewBar() {
  const exit = async () => {
    try { await fetch('/api/admin/themes/preview', { method: 'DELETE' }); } catch { /* the cookie may linger; reloading still shows the site */ }
    window.location.reload();
  };
  return (
    <div className="festive-preview" role="status">
      <span>Previewing a theme</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={exit}>Exit</button>
    </div>
  );
}
