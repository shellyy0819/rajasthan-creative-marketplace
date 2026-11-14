"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AdminProduct as Product, SellerProfile, SourcingType } from "@/lib/types";
import type { AdminArtist } from "@/lib/admin-posts";
import { artistKey } from "@/lib/artist";
import { productSlug } from "@/lib/catalog-shared";
import { money } from "@/lib/money";
import { ProductImage } from "./ProductImage";
import { PhotoButton } from "./PhotoButton";
import { PostForm, type SellerOption, type WorkshopOption } from "./PostForm";
import { ProfileDialog } from "./ProfileDialog";
import { ProfileView } from "./ProfileView";
import { ProductDetail } from "./ProductDetail";
import { PageLoader } from "./PageLoader";
import { Toast, type ToastState } from "./Toast";

const SYMBOLS = ["🌷", "⛵", "🌼", "🏺", "🧶", "🌸"];
const POST_STATUSES = [
  { value: "APPROVED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
] as const;
const symbolFor = (id: string) =>
  SYMBOLS[(Number(id.replace(/\D/g, "")) || 0) % SYMBOLS.length];
const JSON_HEADERS = { "content-type": "application/json" };

function explain(status: number, body: { error?: string } | null): string {
  if (status === 401) return "Your session expired. Please sign in again.";
  // 403s carry a specific reason (e.g. "Only an admin can publish a product."): show it.
  if (status === 403) return body?.error || "You do not have permission to do that.";
  return body?.error || "Something went wrong. Please try again.";
}

export function PostsAdmin({
  initialProducts,
  initialArtists,
  role,
  categories: initialCategories = [],
  sourcingTypes = [],
  workshops = [],
  sellers = [],
  me,
  profile,
  openNew = false,
  openProfile = false,
}: {
  initialProducts: Product[];
  initialArtists: AdminArtist[];
  role: "admin" | "seller";
  categories?: string[];
  sourcingTypes?: SourcingType[];
  workshops?: WorkshopOption[];
  sellers?: SellerOption[];
  me?: SellerOption;
  profile?: SellerProfile;
  /** Open the new-post form on arrival (the page passes it for `?new=1`). Only the initial state; role gates are untouched. */
  openNew?: boolean;
  openProfile?: boolean;
}) {
  const seller = role === "seller";
  const [categories, setCategories] = useState(initialCategories);
  const [editingProfile, setEditingProfile] = useState(openProfile);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const lastViewed = useRef<string | null>(null);
  const [myProfile, setMyProfile] = useState(profile);
  const [products, setProducts] = useState(initialProducts);
  const [artists, setArtists] = useState(initialArtists);
  const [artist, setArtist] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(() => (openNew ? "new" : null));
  const [confirming, setConfirming] = useState<Product | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [pageBusy, setPageBusy] = useState(""); // label of the page-wide loader ("" = idle)
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  // Drop `new=1` from the address once honoured, so a refresh does not re-open the form.
  useEffect(() => {
    if (!openNew) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    url.searchParams.delete("new");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [openNew]);
  // The account menu opens the profile: by address (?profile=1, dropped once honoured) or by event when already here.
  useEffect(() => {
    const open = () => setEditingProfile(true);
    window.addEventListener("craftofy:open-profile", open);
    return () => window.removeEventListener("craftofy:open-profile", open);
  }, []);
  useEffect(() => {
    if (!openProfile) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("profile") !== "1") return;
    url.searchParams.delete("profile");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [openProfile]);
  const notify = (kind: "success" | "error", text: string) =>
    setToast({ id: Date.now() + Math.random(), kind, text });
  const closeToast = useCallback(() => setToast(null), []);

  async function refresh() {
    setPageBusy("Refreshing…");
    try {
      const [p, a] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/artists", { cache: "no-store" }),
      ]);
      if (!p.ok || !a.ok) {
        const bad = p.ok ? a : p;
        notify(
          "error",
          explain(bad.status, await bad.json().catch(() => null)),
        );
        return;
      }
      setProducts(await p.json());
      setArtists(await a.json());
    } catch {
      notify("error", "Could not refresh the list. Check your connection.");
    } finally {
      setPageBusy("");
    }
  }

  async function call(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method,
        headers: JSON_HEADERS,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      // A failed write never triggers a re-fetch of the lists.
      if (!res.ok) return explain(res.status, data);
      return null;
    } catch {
      return "Network error. Please try again.";
    }
  }

  const save = async (payload: Record<string, unknown>) => {
    const isNew = editing === "new";
    const err = await call(
      isNew ? "/api/products" : `/api/products/${(editing as Product).id}`,
      isNew ? "POST" : "PATCH",
      payload,
    );
    if (err) return err;
    setEditing(null);
    setToast(null);
    notify("success", isNew ? "Post created." : "Post saved.");
    await refresh();
    return null;
  };

  const remove = async (p: Product) => {
    setDeleting(p.id);
    const err = await call(`/api/products/${p.id}`, "DELETE");
    setDeleting(null);
    setConfirming(null);
    if (err) {
      notify("error", err);
      return;
    }
    setToast(null);
    notify("success", `Deleted “${p.name}”.`);
    await refresh();
  };

  const changeStatus = async (p: Product, nextStatus: string) => {
    if (nextStatus === p.status) return;
    setChangingStatus(p.id);
    setPageBusy("Updating status…");
    setToast(null);
    const err = await call(`/api/products/${p.id}`, "PATCH", {
      status: nextStatus,
    });
    if (err) notify("error", err);
    else {
      notify("success", `“${p.name}” status updated.`);
      await refresh();
    }
    setChangingStatus(null);
    setPageBusy("");
  };

  const viewing = products.find((x) => x.id === viewingId) ?? null; // always the latest data for the open post
  useEffect(() => {
    if (viewingId) lastViewed.current = viewingId;
    else if (lastViewed.current) {
      document.querySelector<HTMLElement>(`[data-open-id="${lastViewed.current}"]`)?.focus();
      lastViewed.current = null;
    }
  }, [viewingId]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!artist || artistKey(p.seller) === artist) &&
        (!status || p.status === status) &&
        (!needle ||
          `${p.name} ${p.description} ${p.seller}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [products, artist, status, q]);

  const total = artists.reduce((n, a) => n + a.total, 0);
  // the selected artist's public page (it lists only published posts, so it needs one)
  const artistPage = artist ? products.find((p) => artistKey(p.seller) === artist && p.status === "APPROVED")?.sellerSlug : undefined;

  return (
    <section className="admin-posts">
      <div className="page-head">
        <h1>{seller ? "My products" : "Artists’ posts"}</h1>
        <p>
          {seller
            ? "Create and edit your own listings. An admin reviews and publishes them; archive anything you no longer sell."
            : "Create, edit and remove each artist’s listings. Published posts appear on the site; drafts and archived posts stay here."}
        </p>
      </div>
      <Toast toast={toast} onClose={closeToast} />
      <PageLoader show={!!pageBusy} label={pageBusy} />

      <div className={seller ? "admin-grid admin-grid-solo" : "admin-grid"}>
        {!seller && (
        <nav aria-label="Artists" className="admin-artists">
          <button
            type="button"
            className={artist ? "" : "selected"}
            onClick={() => setArtist("")}
          >
            All artists <small>{total}</small>
          </button>
          {artists.map((a) => (
            <button
              key={a.key}
              type="button"
              className={artist === a.key ? "selected" : ""}
              onClick={() => setArtist(a.key)}
            >
              {a.name}{" "}
              <small>
                {a.total}
                {a.drafts
                  ? ` · ${a.drafts} ${a.drafts === 1 ? "draft" : "drafts"}`
                  : ""}
                {a.archived ? ` · ${a.archived} archived` : ""}
              </small>
            </button>
          ))}
        </nav>
        )}

        <div>
          {!seller && artistPage && (
            <p className="admin-artist-link">
              <Link href={`/artists/${artistPage}`}>View {artists.find((x) => x.key === artist)?.name}’s public page ↗</Link>
            </p>
          )}
          <div className="admin-toolbar">
            <input
              aria-label="Search posts"
              placeholder="Search posts…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="APPROVED">Published</option>
              <option value="DRAFT">Drafts</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setToast(null);
                setEditing("new");
              }}
            >
              New post
            </button>
          </div>

          {products.length === 0 ? (
            <div className="empty">No posts yet. Create the first one.</div>
          ) : shown.length === 0 ? (
            <div className="empty">No posts match those filters.</div>
          ) : (
            shown.map((p) => (
              <article
                key={p.id}
                className="admin-row clickable"
                data-testid="post-row"
                onClick={(e) => {
                  // clicks on the row's own controls (status, Edit, Delete, links) keep their own meaning
                  if ((e.target as HTMLElement).closest("button,a,select,input,label,textarea")) return;
                  setViewingId(p.id);
                }}
              >
                <div className="admin-thumb">
                  <PhotoButton images={p.images?.length ? p.images : [p.imageUrl]} label={p.name}>
                    <ProductImage
                      src={p.imageUrl}
                      alt={p.name}
                      fallback={<span aria-hidden="true">{symbolFor(p.id)}</span>}
                    />
                  </PhotoButton>
                </div>
                <div className="admin-row-main">
                  <h3>
                    <button type="button" className="admin-row-open" data-open-id={p.id} onClick={() => setViewingId(p.id)}>
                      {p.name}
                    </button>
                  </h3>
                  <p>
                    {!seller && <>{p.seller}{p.sellerEmail ? ` (${p.sellerEmail})` : ""} · </>}{p.category} · {p.city} · {money(p.pricePaise)}{" "}
                    · {p.stock} in stock
                  </p>
                  <p className="admin-status-line">
                    <span
                      className={`badge ${p.status === "APPROVED" ? "published" : p.status === "ARCHIVED" ? "archived" : "draft"}`}
                    >
                      {p.status === "APPROVED"
                        ? "Published"
                        : p.status === "ARCHIVED"
                          ? "Archived"
                          : "Draft"}
                    </span>
                    {p.status === "APPROVED" && (
                      <Link href={`/products/${productSlug(p)}`}>
                        View public page ↗
                      </Link>
                    )}
                    {!seller && p.status === "APPROVED" && p.sellerSlug && (
                      <Link href={`/artists/${p.sellerSlug}`}>
                        View artist page ↗
                      </Link>
                    )}
                  </p>
                </div>
                {confirming?.id === p.id ? (
                  <div
                    className="admin-confirm"
                    role="group"
                    aria-label={`Confirm delete ${p.name}`}
                  >
                    <span>Delete “{p.name}”? This can’t be undone.</span>
                    <button
                      type="button"
                      className="button"
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      aria-busy={deleting === p.id}
                      disabled={deleting === p.id}
                      onClick={() => remove(p)}
                    >
                      Yes, delete
                    </button>
                  </div>
                ) : (
                  <div className="admin-row-actions">
                    <label className="sr-only" htmlFor={`status-${p.id}`}>
                      Change status for {p.name}
                    </label>
                    <select
                      id={`status-${p.id}`}
                      className="admin-status-select"
                      aria-label={`Change status for ${p.name}`}
                      value={p.status}
                      disabled={changingStatus === p.id}
                      onChange={(e) => void changeStatus(p, e.target.value)}
                    >
                      {POST_STATUSES.map((status) => (
                        <option value={status.value} key={status.value} disabled={seller && status.value === "APPROVED"}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="button"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => {
                        setToast(null);
                        setEditing(p);
                      }}
                    >
                      Edit
                    </button>
                    {!seller && (
                    <button
                        type="button"
                        className="button danger-outline"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => setConfirming(p)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {viewing && !editing && (
        <ProductDetail
          product={viewing}
          role={role}
          onClose={() => setViewingId(null)}
          onEdit={() => {
            setViewingId(null);
            setEditing(viewing);
          }}
        />
      )}
      {editing && (
        <PostForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? undefined : editing}
          role={role}
          categories={categories}
          sourcingTypes={sourcingTypes}
          onCategoryCreated={(name) => setCategories((c) => (c.includes(name) ? c : [...c, name]))}
          workshops={workshops}
          sellers={sellers}
          me={me}
          onSubmit={save}
          onCancel={() => setEditing(null)}
        />
      )}
      {editingProfile && myProfile && seller && myProfile.onboardedAt && (
        <ProfileView
          profile={myProfile}
          publicPageHref={(() => { const slug = products.find((p) => p.status === "APPROVED")?.sellerSlug; return slug ? `/artists/${slug}` : undefined; })()}
          onLogoSaved={(p) => {
            setMyProfile(p);
            notify("success", "Logo saved.");
            void refresh();
          }}
          onClose={() => setEditingProfile(false)}
        />
      )}
      {editingProfile && myProfile && !(seller && myProfile.onboardedAt) && (
        <ProfileDialog
          title="My profile"
          initial={myProfile}
          url="/api/profile"
          accountEmail={me?.email}
          onSaved={(p) => {
            setMyProfile(p);
            setEditingProfile(false);
            notify("success", "Profile saved.");
            void refresh();
          }}
          onCancel={() => setEditingProfile(false)}
        />
      )}
    </section>
  );
}
