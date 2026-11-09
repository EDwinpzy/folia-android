// src/tv/input/tvTrackSkipGesture.ts

import type { TvRoute } from '../model/tvRoute';
import type { TvRemoteAction } from './tvKeys';

export const TV_TRACK_SKIP_INTERVAL_MS = 420;

type TrackDirection = Extract<TvRemoteAction, 'left' | 'right'>;

export type TvTrackSkipGesture = {
    press: (direction: TrackDirection, now: number) => boolean;
    clear: () => void;
};

/** Horizontal presses skip tracks only on the chrome-hidden player; everywhere else they move focus. */
export const handleTvPlayerHorizontalAction = ({
    route,
    action,
    repeat,
    now,
    gesture,
    cancelPendingChromeReveal,
    scheduleChromeReveal,
    skipPrevious,
    next,
    moveFocus,
}: {
    route: Pick<TvRoute, 'page' | 'overlay'>;
    action: TvRemoteAction;
    repeat: boolean;
    now: number;
    gesture: TvTrackSkipGesture;
    cancelPendingChromeReveal: () => void;
    scheduleChromeReveal: () => void;
    skipPrevious: () => void;
    next: () => void;
    moveFocus: (direction: 'left' | 'right') => void;
}): boolean => {
    if (route.page !== 'player' || (action !== 'left' && action !== 'right')) return false;

    if (route.overlay === null) {
        if (repeat) {
            cancelPendingChromeReveal();
            gesture.clear();
            return true;
        }
        if (gesture.press(action, now)) {
            cancelPendingChromeReveal();
            if (action === 'left') skipPrevious();
            else next();
            return true;
        }
        scheduleChromeReveal();
        return true;
    }

    cancelPendingChromeReveal();
    gesture.clear();
    moveFocus(action);
    return true;
};

/** Recognizes two distinct presses in the same horizontal direction while ignoring held-key repeats. */
export const createTvTrackSkipGesture = (
    intervalMs = TV_TRACK_SKIP_INTERVAL_MS,
): TvTrackSkipGesture => {
    let previous: { direction: TrackDirection; at: number } | null = null;

    return {
        press: (direction, now) => {
            const isDoublePress = previous?.direction === direction
                && now - previous.at >= 0
                && now - previous.at <= intervalMs;
            previous = isDoublePress ? null : { direction, at: now };
            return isDoublePress;
        },
        clear: () => {
            previous = null;
        },
    };
};
