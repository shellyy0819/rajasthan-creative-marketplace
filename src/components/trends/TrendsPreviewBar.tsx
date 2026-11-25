'use client';

export function TrendsPreviewBar() {
  const exit = async () => {
    try { await fetch('/api/admin/trends/preview', { method: 'DELETE' }); } catch { /* the cookie may linger; reloading still shows the site */ }
    window.location.reload();
  };
  return (
    <div className="festive-preview" role="status">
      <span>Previewing market trends, not public yet</span>
      <button type="button" onClick={exit}>Exit</button>
    </div>
  );
}
