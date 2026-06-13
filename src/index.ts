#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { createPlaybackStore } from './state.js';
import { handleCurrentTrack } from './tools/current-track.js';
import { handlePlayAlbum } from './tools/play-album.js';
import { handlePlayStation } from './tools/play-station.js';
import { handleMarkCurrent } from './tools/mark-current.js';

const cfg = loadConfig();
const store = createPlaybackStore();
const clock = { now: () => new Date() };

const tools = [
  {
    name: 'current_track',
    description:
      'Return the currently playing track info, based on what this MCP last started. ' +
      'Reflects MCP-driven playback only; manual browser interaction is not tracked.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'play_album',
    description:
      'Play an album by artist + album name. ' +
      'Searches YouTube for `<artist> <album> full album` and opens the top result in Safari.',
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
      'Start a YouTube station from an artist or genre seed. Opens the top result in Safari. ' +
      'When seed is omitted, picks one at random from the Obsidian stations note (MUSIC_STATIONS_PATH).',
    inputSchema: {
      type: 'object',
      properties: {
        seed: { type: 'string', description: 'Artist or genre (optional; falls back to stations note)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mark_current',
    description:
      'Stamp the currently playing track with a reaction (love/like/meh/skip). ' +
      'Appends to the day diary and promotes to an album card on love>=1 or like>=2. ' +
      'YouTube title parsing can be overridden with explicit `artist` / `album` / `track`.',
    inputSchema: {
      type: 'object',
      properties: {
        reaction: { type: 'string', enum: ['love', 'like', 'meh', 'skip'] },
        note: { type: 'string' },
        artist: { type: 'string' },
        album: { type: 'string' },
        track: { type: 'string' },
      },
      required: ['reaction'],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: 'music-digger-mcp', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result: unknown;
  switch (name) {
    case 'current_track':
      result = await handleCurrentTrack({ store });
      break;
    case 'play_album':
      result = await handlePlayAlbum({ store }, args as { artist: string; album: string });
      break;
    case 'play_station':
      result = await handlePlayStation({ cfg, store }, args as { seed?: string });
      break;
    case 'mark_current':
      result = await handleMarkCurrent({ store }, cfg, args as any, clock);
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
