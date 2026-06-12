#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { runAppleScript } from './applescript/runner.js';
import { handleCurrentTrack } from './tools/current-track.js';
import { handlePlayAlbum } from './tools/play-album.js';
import { handlePlayStation } from './tools/play-station.js';
import { handlePlaybackControl } from './tools/playback-control.js';
import { handleMarkCurrent } from './tools/mark-current.js';

const cfg = loadConfig();
const deps = { runner: runAppleScript };
const clock = { now: () => new Date() };

const tools = [
  {
    name: 'current_track',
    description: 'Return the currently playing track info from Music.app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'play_album',
    description: 'Play an album by artist + album name.',
    inputSchema: {
      type: 'object',
      properties: { artist: { type: 'string' }, album: { type: 'string' } },
      required: ['artist', 'album'],
      additionalProperties: false,
    },
  },
  {
    name: 'play_station',
    description:
      'Start an Apple Music station from an artist or genre seed. ' +
      'When seed is omitted, picks one at random from the Obsidian stations note (MUSIC_STATIONS_PATH).',
    inputSchema: {
      type: 'object',
      properties: { seed: { type: 'string', description: 'Artist or genre (optional; falls back to stations note)' } },
      additionalProperties: false,
    },
  },
  {
    name: 'playback_control',
    description: 'Control playback: play / pause / next / previous / repeat_track / repeat_off.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'next', 'previous', 'repeat_track', 'repeat_off'],
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_current',
    description:
      'Stamp the currently playing track with a reaction (love/like/meh/skip). Appends to the day diary and promotes to an album card on love>=1 or like>=2.',
    inputSchema: {
      type: 'object',
      properties: {
        reaction: { type: 'string', enum: ['love', 'like', 'meh', 'skip'] },
        note: { type: 'string' },
      },
      required: ['reaction'],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: 'music-digger-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result: unknown;
  switch (name) {
    case 'current_track':
      result = await handleCurrentTrack(deps);
      break;
    case 'play_album':
      result = await handlePlayAlbum(deps, args as { artist: string; album: string });
      break;
    case 'play_station':
      result = await handlePlayStation({ ...deps, cfg }, args as { seed?: string });
      break;
    case 'playback_control':
      result = await handlePlaybackControl(deps, args as any);
      break;
    case 'mark_current':
      result = await handleMarkCurrent(deps, cfg, args as any, clock);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
