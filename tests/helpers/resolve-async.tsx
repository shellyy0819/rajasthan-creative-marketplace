import React from 'react';

const isAsync = (t: unknown): t is (props: unknown) => Promise<React.ReactNode> =>
  typeof t === 'function' && t.constructor.name === 'AsyncFunction';

/**
 * jsdom cannot render async server components. Walk an element tree, run every async component (the data parts
 * that pages put under <Suspense>) and replace it with what it returns. Suspense boundaries are kept (their
 * fallback is dropped from the result because the content is resolved), so the tree can be passed to render().
 */
export async function resolveAsync(node: React.ReactNode): Promise<React.ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveAsync));
  if (!React.isValidElement(node)) return node;
  if (isAsync(node.type)) return resolveAsync(await node.type(node.props));
  const props = node.props as { children?: React.ReactNode };
  if (props.children === undefined) return node;
  return React.cloneElement(node, undefined, await resolveAsync(props.children));
}

/** The page as a visitor sees it before any data arrives: every <Suspense> is replaced by its fallback. */
export function shellOnly(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map(shellOnly);
  if (!React.isValidElement(node)) return node;
  if (node.type === React.Suspense) return shellOnly((node.props as { fallback?: React.ReactNode }).fallback ?? null);
  const props = node.props as { children?: React.ReactNode };
  if (props.children === undefined) return node;
  return React.cloneElement(node, undefined, shellOnly(props.children));
}
