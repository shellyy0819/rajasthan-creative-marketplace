'use client';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { HeroStall } from './HeroStall';
import type { ThemeDto } from '@/lib/themes/dto';
import { addSticker, clampPlacement, effectivePrimary, haloOf, nudge, previewVars, primaryContrast, removeSticker, resize, stickerGroups } from '@/lib/themes/editor';
import { PRESETS } from '@/lib/themes/presets';
import { STICKERS, type StickerId } from '@/lib/themes/stickers';
import { LIMITS, type Placement, type ThemeConfig } from '@/lib/themes/types';

const WORDING = [
  ['banner', 'Banner line', LIMITS.banner],
  ['sign', 'Signboard', LIMITS.sign],
  ['chalkLabel', 'Chalkboard label', LIMITS.chalkLabel],
  ['chalkTitle', 'Chalkboard title', LIMITS.chalkTitle],
  ['chalkSub', 'Chalkboard line', LIMITS.chalkSub],
] as const;

export type EditorSave = { config: ThemeConfig; startsAtIst?: string | null; endsAtIst?: string | null };

/** Edits one theme (or the Everyday base). The preview is the real home-hero stall, so what the admin sees is what visitors get. */
export function ThemeEditor({ theme, isBase, saving, onSave, onClose }: {
  theme: ThemeDto; isBase: boolean; saving: boolean; onSave: (v: EditorSave) => void; onClose: () => void;
}) {
  const [cfg, setCfg] = useState<ThemeConfig>(theme.config);
  const [startsAt, setStartsAt] = useState(theme.startsAtIst ?? '');
  const [endsAt, setEndsAt] = useState(theme.endsAtIst ?? '');
  const [selected, setSelected] = useState<StickerId | null>(null);
  const stage = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: StickerId; px: number; py: number; ox: number; oy: number } | null>(null);

  const preset = theme.preset;
  const primary = effectivePrimary(preset, cfg);
  const contrast = primaryContrast(primary);
  const windowBad = !isBase && !!startsAt && !!endsAt && endsAt <= startsAt;
  const canSave = contrast.ok && !windowBad && !saving;
  const set = (patch: Partial<ThemeConfig>) => setCfg(c => ({ ...c, ...patch }));
  const update = (id: StickerId, fn: (p: Placement) => Placement) => setCfg(c => ({ ...c, stickers: c.stickers.map(p => (p.id === id ? fn(p) : p)) }));
  const byId = (id: StickerId) => cfg.stickers.find(p => p.id === id);

  function onKey(e: KeyboardEvent, id: StickerId) {
    const step = e.shiftKey ? 16 : 4;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (move[e.key]) { e.preventDefault(); update(id, p => nudge(p, ...move[e.key])); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); update(id, p => resize(p, 0.1)); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); update(id, p => resize(p, -0.1)); }
  }
  function down(e: PointerEvent<SVGRectElement>, id: StickerId) {
    const p = byId(id);
    if (!p) return;
    setSelected(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, px: e.clientX, py: e.clientY, ox: p.x, oy: p.y };
  }
  function move(e: PointerEvent<SVGRectElement>) {
    const d = drag.current, svg = stage.current;
    if (!d || !svg) return;
    const k = 600 / (svg.getBoundingClientRect().width || 600); // screen px to viewBox units
    update(d.id, p => clampPlacement({ ...p, x: d.ox + (e.clientX - d.px) * k, y: d.oy + (e.clientY - d.py) * k }));
  }
  const up = () => { drag.current = null; };

  return (
    <section className="theme-editor" aria-label={`Edit ${theme.label} theme`}>
      <div className="theme-editor-head">
        <h2>{isBase ? 'Everyday (default look)' : `${theme.label} theme`}</h2>
        <button type="button" className="button" onClick={onClose}>Close</button>
      </div>
      <p className="form-note"><b>*</b> Required</p>
      <div className="theme-editor-grid">
        <div className="theme-stage-wrap">
          <div className="theme-stage" style={previewVars(preset, cfg) as CSSProperties}>
            <HeroStall sign={cfg.sign} chalkLabel={cfg.chalkLabel} chalkTitle={cfg.chalkTitle} chalkSub={cfg.chalkSub} bunting={cfg.bunting} stickers={cfg.stickers} />
            <svg ref={stage} className="theme-overlay" viewBox="0 0 600 720" role="group" aria-label="Sticker positions. Select a sticker, then use arrow keys to move and plus or minus to resize.">
              {cfg.stickers.map(p => {
                if (!(p.id in STICKERS)) return null;
                const h = haloOf(STICKERS[p.id as StickerId].box, p);
                const id = p.id as StickerId;
                return (
                  <rect key={p.id} className={`theme-halo${selected === id ? ' on' : ''}`} x={h.x} y={h.y} width={h.w} height={h.h} rx={6}
                    tabIndex={0} role="button" aria-label={`${STICKERS[id].label}: ${Math.round(p.x)}, ${Math.round(p.y)}, size ${p.s}`}
                    onFocus={() => setSelected(id)} onKeyDown={e => onKey(e, id)}
                    onPointerDown={e => down(e, id)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
                );
              })}
            </svg>
          </div>
          <p className="muted">Drag a sticker, or focus it and use the arrow keys (hold Shift for bigger steps) and + / − to resize.</p>
        </div>

        <form className="admin-form" onSubmit={e => { e.preventDefault(); if (canSave) onSave({ config: cfg, ...(isBase ? {} : { startsAtIst: startsAt || null, endsAtIst: endsAt || null }) }); }}>
          {!isBase && (
            <div className="admin-form-row">
              <label><span className="lbl">Starts (IST)</span><input type="datetime-local" required value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
              <label><span className="lbl">Ends (IST)</span><input type="datetime-local" required value={endsAt} min={startsAt || undefined} onChange={e => setEndsAt(e.target.value)} aria-invalid={windowBad} /></label>
            </div>
          )}
          {windowBad && <p className="form-error" role="alert">The end must be after the start.</p>}

          <label>
            <span className="lbl">Primary colour</span>
            <span className="theme-colour">
              <input type="color" value={primary} aria-label="Primary colour" onChange={e => set({ primary: e.target.value.toUpperCase() })} />
              <code>{primary}</code>
              <span className={contrast.ok ? 'theme-ratio ok' : 'theme-ratio bad'} role="status">
                {contrast.ok ? `Text contrast ${contrast.ratio}:1 ✓` : `Text contrast ${contrast.ratio}:1, needs 4.5:1. Pick a darker or lighter colour.`}
              </span>
              {cfg.primary && <button type="button" className="button" onClick={() => setCfg(c => { const { primary: _drop, ...rest } = c; void _drop; return rest; })}>Use preset colour</button>}
            </span>
          </label>

          {WORDING.map(([key, label, max]) => (
            <div key={key}>
              <label>
                <span className="lbl">{label}</span>
                <input required maxLength={max} value={cfg[key]} onChange={e => set({ [key]: e.target.value })} />
              </label>
              <small className="muted" aria-hidden="true">{cfg[key].length}/{max}</small>
            </div>
          ))}

          <label className="theme-check"><input type="checkbox" checked={cfg.bunting} onChange={e => set({ bunting: e.target.checked })} /> Show bunting</label>

          <fieldset className="theme-stickers">
            <legend>Stickers</legend>
            {stickerGroups().map(g => (
              <div key={g.set} className="theme-sticker-group">
                <b>{g.label}{g.set === preset ? ' (this theme)' : ''}</b>
                {g.ids.map(id => (
                  <label key={id} className="theme-check">
                    <input type="checkbox" checked={!!byId(id)} onChange={e => { set({ stickers: e.target.checked ? addSticker(cfg.stickers, id) : removeSticker(cfg.stickers, id) }); setSelected(e.target.checked ? id : null); }} />
                    {STICKERS[id].label}
                  </label>
                ))}
              </div>
            ))}
            <button type="button" className="button" onClick={() => set({ stickers: PRESETS[preset].config.stickers })}>Reset stickers to {PRESETS[preset].label} defaults</button>
          </fieldset>

          <div className="admin-row-actions">
            <button type="submit" className="button primary" disabled={!canSave} aria-busy={saving}>Save</button>
            <button type="button" className="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </section>
  );
}
