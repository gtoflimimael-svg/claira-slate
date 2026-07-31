"use client";

import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 50;

export interface OrganizeHistory<T> {
  state: T;
  commit: (next: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (next: T) => void;
  /** Updates state without touching the undo/redo stacks — for non-user-action
   *  data events (e.g. a newly-added source PDF's pages arriving once pdf.js
   *  reports its page count), which the spec doesn't list as undoable. Accepts
   *  an updater function (forwarded straight to the underlying setState) so
   *  callers invoked from an async closure — e.g. two PDFs finishing their
   *  pdf.js load back to back — always apply against the latest state rather
   *  than whatever `state` looked like when that closure was created. */
  setSilently: (next: T | ((prev: T) => T)) => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Snapshot-stack undo/redo, capped at 50 steps. The stacks themselves live in
// refs (mutating them doesn't need a re-render), but canUndo/canRedo are
// mirrored into real state — reading `ref.current` during render to derive
// them is a lint error (react-hooks/refs) and, more importantly, wouldn't
// reliably trigger a re-render when the stacks change.
//
// `commit`/`undo`/`redo` read `state` from the surrounding closure and call
// setState with a plain value rather than the updater-function form: React
// 19 invokes updater functions twice in dev to check purity, which would
// double-push onto the ref-based history stacks.
export function useOrganizeHistory<T>(initial: T): OrganizeHistory<T> {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const commit = useCallback(
    (next: T) => {
      past.current.push(state);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
      setState(next);
      setCanUndo(true);
      setCanRedo(false);
    },
    [state]
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(state);
    setState(prev);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
  }, [state]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(state);
    setState(next);
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
  }, [state]);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    setState(next);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const setSilently = useCallback((next: T | ((prev: T) => T)) => {
    setState(next);
  }, []);

  return {
    state,
    commit,
    undo,
    redo,
    reset,
    setSilently,
    canUndo,
    canRedo,
  };
}
