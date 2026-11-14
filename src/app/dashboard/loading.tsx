/** Shown inside the dashboard the moment a tab is clicked: the header and tabs stay put and only the page body waits. */
export default function DashboardLoading() {
  return (
    <section className="admin-posts" role="status" aria-busy="true" aria-label="Loading">
      <div className="page-head">
        <span className="dash-skel dash-skel-title" />
      </div>
      <div className="admin-grid admin-grid-solo">
        <div className="dash-skel-list" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <span key={i} className="dash-skel dash-skel-row" />)}
        </div>
      </div>
    </section>
  );
}
