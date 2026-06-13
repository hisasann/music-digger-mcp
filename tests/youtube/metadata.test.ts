import { describe, it, expect } from 'vitest';
import { stripTitleNoise, parseTrackTitle } from '../../src/youtube/metadata.js';

describe('stripTitleNoise', () => {
  it('removes "(Official Audio)" variants', () => {
    expect(stripTitleNoise('Foo (Official Audio)')).toBe('Foo');
    expect(stripTitleNoise('Foo [Official Music Video]')).toBe('Foo');
    expect(stripTitleNoise('Foo (Official Lyric Video)')).toBe('Foo');
  });

  it('removes year markers', () => {
    expect(stripTitleNoise('Foo (1976)')).toBe('Foo');
    expect(stripTitleNoise('Foo - 1969')).toBe('Foo');
  });

  it('removes "(Full Album)" and "Full Album"', () => {
    expect(stripTitleNoise('Hot Buttered Soul (Full Album)')).toBe('Hot Buttered Soul');
    expect(stripTitleNoise('Hot Buttered Soul FULL ALBUM')).toBe('Hot Buttered Soul');
  });

  it('collapses whitespace from stripped noise', () => {
    expect(stripTitleNoise('Foo (Official Audio)  bar')).toBe('Foo bar');
  });

  it('leaves clean titles untouched', () => {
    expect(stripTitleNoise('Roy Ayers - Everybody Loves The Sunshine')).toBe(
      'Roy Ayers - Everybody Loves The Sunshine',
    );
  });
});

describe('parseTrackTitle', () => {
  it('splits "Artist - Track" titles and strips "- Topic" from channel for album', () => {
    expect(parseTrackTitle('Roy Ayers - Everybody Loves The Sunshine', 'Roy Ayers Ubiquity - Topic')).toEqual({
      artist: 'Roy Ayers',
      track: 'Everybody Loves The Sunshine',
      album: 'Roy Ayers Ubiquity',
    });
  });

  it('strips noise before splitting', () => {
    expect(parseTrackTitle('Aaron Frazer - Bad News (Official Audio)', 'Aaron Frazer - Topic')).toEqual({
      artist: 'Aaron Frazer',
      track: 'Bad News',
      album: 'Aaron Frazer',
    });
  });

  it('falls back to channel-derived artist when no dash is present in the title', () => {
    expect(parseTrackTitle('Just a one-piece title', 'Some Topic Uploader')).toEqual({
      artist: 'Some Topic Uploader',
      track: 'Just a one-piece title',
      album: 'Some Topic Uploader',
    });
  });

  it('uses the channel as album when artist appears nowhere obvious', () => {
    expect(parseTrackTitle('Random One Track', 'Indie Channel')).toEqual({
      artist: 'Indie Channel',
      track: 'Random One Track',
      album: 'Indie Channel',
    });
  });
});
