/** Always rendered, always 38px tall, so changing the wording (or the theme) never moves the page. */
export function ThemeBanner({ text }: { text: string }) {
  return <div className="festive-banner" role="note">{text}</div>;
}
