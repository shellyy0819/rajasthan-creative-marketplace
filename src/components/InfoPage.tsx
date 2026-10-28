/** Heading block and body shared by the plain content pages linked from the footer. Pages render their own breadcrumbs. */
export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: React.ReactNode }) {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {children && <section className="section info-body">{children}</section>}
    </>
  );
}
