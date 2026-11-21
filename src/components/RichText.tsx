import { Fragment } from 'react';
import { parseRich, type Span } from '@/lib/rich-text';
import './RichTextField.css';

function Inline({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        let node: React.ReactNode = s.text;
        if (s.underline) node = <u>{node}</u>;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong>{node}</strong>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}

/**
 * Shows a value written in the Experience and Certifications editor: paragraphs, bullets, numbers, bold, italic, underline.
 * Built from React elements, never from HTML, so whatever was typed can only ever be text.
 */
export function RichText({ value, className }: { value: string | null | undefined; className?: string }) {
  const blocks = parseRich(value);
  if (!blocks.length) return null;
  return (
    <div className={`rich-text${className ? ` ${className}` : ''}`}>
      {blocks.map((b, i) => b.type === 'p'
        ? <p key={i}><Inline spans={b.spans} /></p>
        : b.type === 'ul'
          ? <ul key={i}>{b.items.map((it, j) => <li key={j}><Inline spans={it} /></li>)}</ul>
          : <ol key={i}>{b.items.map((it, j) => <li key={j}><Inline spans={it} /></li>)}</ol>)}
    </div>
  );
}
