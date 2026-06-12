import type { AppleScriptRunner } from './runner.js';

const SEP = '\x1f';

export type PlaybackAction =
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'repeat_track'
  | 'repeat_off';

export type PlaybackState = 'playing' | 'paused' | 'stopped';
export type RepeatMode = 'off' | 'one' | 'all';

export interface PlaybackResult {
  ok: true;
  state: PlaybackState;
  repeat_mode: RepeatMode;
}

const validStates = ['playing', 'paused', 'stopped'] as const;
const validRepeats = ['off', 'one', 'all'] as const;

function actionScriptBody(action: PlaybackAction): string {
  switch (action) {
    case 'play': return 'if player state is paused or player state is stopped then play';
    case 'pause': return 'pause';
    case 'next': return 'next track';
    case 'previous': return 'previous track';
    case 'repeat_track': return 'set song repeat to one';
    case 'repeat_off': return 'set song repeat to off';
  }
}

export async function sendPlaybackAction(
  runner: AppleScriptRunner,
  action: PlaybackAction,
): Promise<PlaybackResult> {
  const body = actionScriptBody(action);
  const script = `
tell application "Music"
  ${body}
  set st to player state as string
  set rm to song repeat as string
  return st & "${SEP}" & rm
end tell
`;
  const out = await runner(script);
  const [state, repeat] = out.split(SEP);
  const safeState: PlaybackState = (validStates as readonly string[]).includes(state)
    ? (state as PlaybackState)
    : 'stopped';
  const safeRepeat: RepeatMode = (validRepeats as readonly string[]).includes(repeat)
    ? (repeat as RepeatMode)
    : 'off';
  return {
    ok: true,
    state: safeState,
    repeat_mode: safeRepeat,
  };
}
