'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="page-head" style={{ paddingBottom: 80 }}>
      <h1>Something went wrong.</h1>
      <p>Please try again.</p>
      <button className="button primary" onClick={reset}>Try again</button>
    </section>
  );
}
