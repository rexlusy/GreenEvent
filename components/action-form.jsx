"use client";

import { useActionState, useEffect, useRef } from "react";

export function ActionForm({ action, children, className = "stack" }) {
  const [state, submit, pending] = useActionState(action, {});
  const form = useRef(null);
  const submitted = useRef(null);
  useEffect(() => {
    if (!state.error || !submitted.current) return;
    for (const [name, value] of submitted.current) {
      const input = form.current?.elements.namedItem(name);
      if (input && input.type !== "password" && typeof value === "string") input.value = value;
    }
  }, [state]);
  return (
    <form ref={form} action={submit} className={className} aria-busy={pending}
      onSubmit={() => { submitted.current = new FormData(form.current); }}>
      <fieldset className="form-fields" disabled={pending}>
        {children}
      </fieldset>
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      {state.success && <p className="notice success" role="status">{state.success}</p>}
    </form>
  );
}

export function CopyButton({ inputId }) {
  const status = useRef(null);

  async function copy() {
    const source = document.getElementById(inputId);
    if (!source) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(source.value);
        status.current.textContent = "Tautan disalin.";
        return;
      } catch {
        // Selecting the URL also works on a local HTTP network.
      }
    }
    source.select();
    status.current.textContent = "Tautan dipilih. Gunakan Salin.";
  }

  return <div><button type="button" className="button button-quiet button-small" onClick={copy}>Salin tautan</button>
    <span className="hint copy-status" role="status" ref={status} /></div>;
}
