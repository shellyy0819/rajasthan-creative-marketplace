'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { escapeLineStart, richLength, richToEditorHtml, wrapSpan } from '@/lib/rich-text';
import './RichTextField.css';

type Marks = { bold?: boolean; italic?: boolean; underline?: boolean };

/**
 * What the editor shows, written in the stored format (see lib/rich-text). Only the text and these marks are read: whatever else the browser
 * put in the box (spans, styles, links) is dropped, so the stored value is always plain text.
 */
export function serializeEditor(root: HTMLElement): string {
  const lines: string[] = [];
  let cur = '';
  const flush = (prefix = '') => {
    if (cur.trim()) lines.push(prefix ? `${prefix}${cur.trim()}` : escapeLineStart(cur.trim()));
    cur = '';
  };
  const walk = (parent: Node, marks: Marks) => {
    parent.childNodes.forEach(n => {
      if (n.nodeType === 3) { cur += wrapSpan((n.textContent ?? '').replace(/ /g, ' ').replace(/\n/g, ' '), marks); return; }
      if (!(n instanceof HTMLElement)) return;
      const tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      if (tag === 'BR') { flush(); return; }
      if (tag === 'UL' || tag === 'OL') {
        flush();
        let i = 0;
        n.querySelectorAll(':scope > li').forEach(li => { i++; walk(li, marks); flush(tag === 'UL' ? '- ' : `${i}. `); });
        return;
      }
      const next: Marks = {
        bold: marks.bold || tag === 'B' || tag === 'STRONG',
        italic: marks.italic || tag === 'I' || tag === 'EM',
        underline: marks.underline || tag === 'U',
      };
      if (tag === 'DIV' || tag === 'P') { flush(); walk(n, next); flush(); } else walk(n, next);
    });
  };
  walk(root, {});
  flush();
  return lines.join('\n');
}

const COMMANDS = [
  { cmd: 'bold', label: 'Bold', icon: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /> },
  { cmd: 'italic', label: 'Italic', icon: <path d="M19 4h-9M14 20H5M15 4L9 20" /> },
  { cmd: 'underline', label: 'Underline', icon: <path d="M6 4v7a6 6 0 0 0 12 0V4M4 21h16" /> },
  { cmd: 'insertUnorderedList', label: 'Bulleted list', icon: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" /> },
  { cmd: 'insertOrderedList', label: 'Numbered list', icon: <path d="M10 6h11M10 12h11M10 18h11M4 5l1.5-1v4M3.5 13.5c.5-1.5 2.5-1 2.5.3 0 1-2.5 2-2.5 3h3M3.5 20h2.5l-1.5-1.5c1.3 0 1.8-1 1.5-1.8" /> },
] as const;

/**
 * A small text editor for the Experience and Certifications fields: bold, italic, underline, bulleted and numbered lists.
 * It keeps its value in a hidden input called `name`, so forms read it like any other field. Code that fills the field from outside (a restored
 * draft, an edited listing) sets that input's value and fires `rr-sync`, and the editor follows. Pasted text is always plain.
 */
export function RichTextField({ name, label, max = 500, error }: { name: string; label: string; max?: number; error?: string }) {
  const labelId = useId();
  const editor = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>({});

  const readState = () => {
    const q = (c: string) => { try { return document.queryCommandState?.(c) ?? false; } catch { return false; } };
    setOn(Object.fromEntries(COMMANDS.map(c => [c.cmd, q(c.cmd)])));
  };
  /** Copy what the box shows into the hidden field, and tell the form (so a draft is saved and an error under the field clears). */
  const commit = () => {
    const ed = editor.current, h = hidden.current;
    if (!ed || !h) return;
    h.value = serializeEditor(ed);
    setCount(richLength(h.value));
    h.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Follow a value set from outside.
  useEffect(() => {
    const h = hidden.current, ed = editor.current;
    if (!h || !ed) return;
    // richToEditorHtml escapes every character of the text and produces only the formatting tags itself, so nothing typed can become markup.
    const read = () => { ed.innerHTML = richToEditorHtml(h.value); setCount(richLength(h.value)); };
    h.addEventListener('rr-sync', read);
    return () => h.removeEventListener('rr-sync', read);
  }, []);
  useEffect(() => {
    const onSel = () => { if (editor.current?.contains(document.getSelection()?.anchorNode ?? null)) readState(); };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const run = (cmd: string) => {
    editor.current?.focus();
    document.execCommand?.(cmd, false);
    commit();
    readState();
  };
  const overBy = count - max;

  return (
    <div className="rich-field" role="group" aria-labelledby={labelId}>
      <span className="rich-label" id={labelId}>{label}</span>
      <div className="rich-box" data-invalid={error || overBy > 0 ? 'true' : undefined}>
        <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
          {COMMANDS.map(c => (
            <button key={c.cmd} type="button" className="rich-btn" aria-label={c.label} title={c.label} aria-pressed={!!on[c.cmd]}
              onMouseDown={e => e.preventDefault()} /* keep the selection in the box */ onClick={() => run(c.cmd)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c.icon}</svg>
            </button>
          ))}
        </div>
        <div ref={editor} className="rich-editor" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-labelledby={labelId}
          aria-invalid={error || overBy > 0 ? true : undefined} data-field={name} spellCheck
          onInput={commit} onKeyUp={readState} onMouseUp={readState}
          onBeforeInput={e => {
            // Stop typing at the limit (a selection being replaced may still shrink the text).
            const ev = e.nativeEvent as InputEvent;
            const sel = document.getSelection();
            if (ev.inputType.startsWith('insert') && count >= max && sel?.isCollapsed) e.preventDefault();
          }}
          onPaste={e => {
            e.preventDefault(); // pasted formatting, links and styles never get in: only the words do
            const room = Math.max(0, max - count);
            const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').slice(0, room + 200);
            if (text) document.execCommand?.('insertText', false, text);
          }}
          onDrop={e => e.preventDefault()}
        />
      </div>
      <input ref={hidden} type="hidden" name={name} />
      <small className={`rich-count${overBy > 0 ? ' over' : ''}`} aria-live="polite">{count}/{max}</small>
    </div>
  );
}
