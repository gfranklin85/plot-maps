'use client';

// ── useMapMode — the single owner of map mode ────────────────────────
//
// Replaces three tangled booleans (view3D / flightMode / walkMode) that
// could desync and trap the user in 3D with no way back to 2D. Now ONE
// state machine owns the mode; everything else is DERIVED, so the
// "stuck in 3D" class of bug is structurally impossible.
//
// Modes:
//   WORK_2D  — flat top-down map. The lightweight prospecting grinder.
//   FLY_3D   — tilted photoreal flight. Cockpit feel auto-engages when a
//              gamepad is driving (that IS the old 'airplane' mode); a
//              mouse gets the 'overhead' feel. flightMode is no longer
//              independent state — it's derived from gamepad presence.
//   WALK     — Street View first-person. Entered from 2D or 3D; on exit
//              returns to whichever ground mode you came from.
//
// The reducer is pure. Camera side-effects (tilt to 0 leaving 3D, tilt
// to 65 entering 3D) are returned as an optional `flight` intent that
// the caller dispatches — keeps the hook free of MapView coupling.
//
// See [[project-2d-work-mode]] and the control-architecture plan.

import { useReducer, useCallback, useMemo } from 'react';

export type MapMode = 'WORK_2D' | 'FLY_3D' | 'WALK';

type GroundMode = 'WORK_2D' | 'FLY_3D';

interface MapModeState {
  mode: MapMode;
  /** Where WALK returns to on exit. */
  prevGroundMode: GroundMode;
  /** Mirrors page-level gamepad detection; drives the cockpit feel. */
  gamepadPresent: boolean;
}

export type MapModeAction =
  | { type: 'ENTER_2D' }
  | { type: 'ENTER_3D' }
  | { type: 'ENTER_WALK' }
  | { type: 'EXIT_WALK' }
  | { type: 'GAMEPAD_CONNECTED' }
  | { type: 'GAMEPAD_DISCONNECTED' };

/** A camera framing intent the reducer wants, for the caller to fly to.
 *  Null when a transition needs no camera move. */
export interface ModeFlightIntent {
  tilt: number;
  zoom?: number;
}

interface ReducerCtx {
  has3DSupport: boolean;
}

// The reducer returns the next state AND an optional flight intent +
// optional gate signal, bundled so the hook can surface them.
interface ReduceResult {
  state: MapModeState;
  flight?: ModeFlightIntent | null;
  /** Set when a guard blocked the transition (caller shows toast/gate). */
  blocked?: 'no3d' | null;
}

function reduce(state: MapModeState, action: MapModeAction, ctx: ReducerCtx): ReduceResult {
  switch (action.type) {
    case 'ENTER_2D': {
      if (state.mode === 'WORK_2D') return { state };
      // Leaving FLY_3D: flatten the camera so we never land in a stale tilt.
      const flight = state.mode === 'FLY_3D' ? { tilt: 0 } : null;
      return { state: { ...state, mode: 'WORK_2D' }, flight };
    }

    case 'ENTER_3D': {
      if (!ctx.has3DSupport) return { state, blocked: 'no3d' };
      if (state.mode === 'FLY_3D') return { state };
      return {
        state: { ...state, mode: 'FLY_3D' },
        flight: { tilt: 65, zoom: 18 },
      };
    }

    case 'ENTER_WALK': {
      if (state.mode === 'WALK') return { state };
      const prevGroundMode: GroundMode = state.mode === 'FLY_3D' ? 'FLY_3D' : 'WORK_2D';
      return { state: { ...state, mode: 'WALK', prevGroundMode } };
    }

    case 'EXIT_WALK': {
      if (state.mode !== 'WALK') return { state };
      // Return to the ground mode we came from. If that's 3D, re-tilt.
      const flight = state.prevGroundMode === 'FLY_3D' ? { tilt: 65 } : { tilt: 0 };
      return { state: { ...state, mode: state.prevGroundMode }, flight };
    }

    case 'GAMEPAD_CONNECTED': {
      // Plugging a controller in auto-selects flight — but only from the
      // flat work map. Never yank someone out of WALK.
      if (state.mode === 'WORK_2D' && ctx.has3DSupport) {
        return {
          state: { ...state, gamepadPresent: true, mode: 'FLY_3D' },
          flight: { tilt: 65, zoom: 18 },
        };
      }
      return { state: { ...state, gamepadPresent: true } };
    }

    case 'GAMEPAD_DISCONNECTED': {
      // Do NOT force back to 2D — that was the old mid-flight jolt. The
      // cockpit feel just drops to overhead via the derived flightMode.
      return { state: { ...state, gamepadPresent: false } };
    }

    default:
      return { state };
  }
}

export interface UseMapModeResult {
  mode: MapMode;
  // Derived selectors — 1:1 replacements for the old booleans, so every
  // downstream prop/consumer keeps its exact contract.
  view3D: boolean;
  walkMode: boolean;
  flightMode: 'overhead' | 'airplane';
  /** Convenience: gamepad is present AND we're in flight (caller still
   *  ANDs its own debug flag). */
  gamepadDrivingFlight: boolean;
  gamepadPresent: boolean;
  /** Dispatch a transition. Side-effects (camera flight, gate) are routed
   *  through the callbacks passed to useMapMode. */
  dispatch: (action: MapModeAction) => void;
}

interface UseMapModeOpts {
  has3DSupport: boolean;
  /** Fly the camera for a transition (tilt flatten / re-tilt). */
  onFlight?: (intent: ModeFlightIntent) => void;
  /** A guarded transition was blocked (e.g. 3D unsupported). */
  onBlocked?: (reason: 'no3d') => void;
}

export function useMapMode({ has3DSupport, onFlight, onBlocked }: UseMapModeOpts): UseMapModeResult {
  // We drive a thin useReducer over MapModeState, but run the richer
  // `reduce` ourselves so we can surface the flight/blocked side-channel.
  const [state, rawDispatch] = useReducer(
    (s: MapModeState, a: MapModeAction) => reduce(s, a, { has3DSupport }).state,
    { mode: 'WORK_2D', prevGroundMode: 'WORK_2D', gamepadPresent: false },
  );

  const dispatch = useCallback(
    (action: MapModeAction) => {
      // Compute the side-effects against the CURRENT state, then commit.
      const { flight, blocked } = reduce(state, action, { has3DSupport });
      if (blocked === 'no3d') { onBlocked?.('no3d'); return; }
      if (flight) onFlight?.(flight);
      rawDispatch(action);
    },
    [state, has3DSupport, onFlight, onBlocked],
  );

  return useMemo<UseMapModeResult>(() => {
    const gamepadDrivingFlight = state.gamepadPresent && state.mode === 'FLY_3D';
    return {
      mode: state.mode,
      view3D: state.mode === 'FLY_3D',
      walkMode: state.mode === 'WALK',
      flightMode: gamepadDrivingFlight ? 'airplane' : 'overhead',
      gamepadDrivingFlight,
      gamepadPresent: state.gamepadPresent,
      dispatch,
    };
  }, [state, dispatch]);
}
