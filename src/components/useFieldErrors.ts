import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Errors shown right under the field they are about. `show` finds the field by its name (or a `data-field` group), goes to the step
 * that holds it, and moves focus there once it is on screen. It returns false when there is no such field, so the caller can use a banner.
 */
export function useFieldErrors(formRef: RefObject<HTMLFormElement | null>, setStep?: (n: number) => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = useRef<string | null>(null);
  const find = (name: string) => formRef.current?.querySelector<HTMLElement>(`[name="${name}"], [data-field="${name}"]`) ?? null;

  const show = (name: string, text: string): boolean => {
    const el = find(name);
    if (!el) return false;
    const stepAttr = el.closest('[data-step]')?.getAttribute('data-step');
    if (stepAttr != null && setStep) setStep(Number(stepAttr));
    pending.current = name;
    setErrors({ [name]: text });
    return true;
  };
  const clear = (name: string) => setErrors(e => {
    if (!(name in e)) return e;
    const { [name]: _gone, ...rest } = e;
    return rest;
  });
  const clearAll = () => setErrors(e => (Object.keys(e).length ? {} : e));

  useEffect(() => {
    const n = pending.current;
    if (!n) return;
    pending.current = null;
    const el = find(n);
    if (!el || (el instanceof HTMLInputElement && el.type === 'hidden')) return;
    el.scrollIntoView?.({ block: 'center' });
    el.focus?.();
  }, [errors]); // eslint-disable-line react-hooks/exhaustive-deps

  return { errors, show, clear, clearAll };
}
