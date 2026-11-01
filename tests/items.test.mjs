import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeValue,
    deriveSkinlineFromName,
    resolveSkinName,
    resolveAssetTitle,
    resolveReleaseYear,
    resolveSkinReleaseDate,
    compareSkinReleaseDates,
    isRecentlyUploaded,
    formatUploadedAt,
    formatSkinReleaseDate,
    isExternalItem,
    resolveMediaUrl,
    getYouTubeVideoId,
    getYouTubeEmbedUrl,
    getExternalPreviewImageUrl,
    escapeHtml
} from '../js/items.js';

test('normalizeValue trims strings only', () => {
    assert.equal(normalizeValue('  a '), 'a');
    assert.equal(normalizeValue(5), 5);
});

test('deriveSkinlineFromName strips trailing Ezreal', () => {
    assert.equal(deriveSkinlineFromName('Pulsefire Ezreal'), 'Pulsefire');
    assert.equal(deriveSkinlineFromName(''), 'No Skinline');
    assert.equal(deriveSkinlineFromName('Ezreal'), 'Ezreal');
});

test('resolveSkinName and resolveAssetTitle fall back', () => {
    assert.equal(resolveSkinName({}), 'Unknown Skin');
    assert.equal(resolveAssetTitle({ title: ' T ' }, 'S'), 'T');
    assert.equal(resolveAssetTitle({ url: 'a/b.jpg' }, 'S'), 'a/b.jpg');
    assert.equal(resolveAssetTitle({}, 'S'), 'S');
});

test('resolveReleaseYear prefers asset year', () => {
    assert.equal(resolveReleaseYear({ releaseYear: 2020 }, { assetReleaseYear: 2021 }), '2021');
    assert.equal(resolveReleaseYear({ releaseYear: 2020 }, {}), '2020');
    assert.equal(resolveReleaseYear({}, {}), 'Unknown');
});

test('resolveSkinReleaseDate', () => {
    assert.equal(resolveSkinReleaseDate({ skinReleaseDate: '2026-10-07' }), '2026-10-07');
    assert.equal(resolveSkinReleaseDate({}), 'Unknown');
});

test('compareSkinReleaseDates orders by year then date, unknown last', () => {
    assert.ok(compareSkinReleaseDates('2020', '2021') < 0);
    assert.ok(compareSkinReleaseDates('2021-05-01', '2021-04-01') > 0);
    assert.ok(compareSkinReleaseDates('2021-05-01', '2021-04-01', true) < 0);
    assert.ok(compareSkinReleaseDates('Unknown', '2021') > 0);
    assert.equal(compareSkinReleaseDates('Unknown', 'Unknown'), 0);
});

test('isRecentlyUploaded uses a 7 day window', () => {
    const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
    assert.equal(isRecentlyUploaded({ uploadedAt: daysAgo(6) }), true);
    assert.equal(isRecentlyUploaded({ uploadedAt: daysAgo(8) }), false);
    assert.equal(isRecentlyUploaded({ uploadedAt: '' }), false);
    assert.equal(isRecentlyUploaded({ uploadedAt: new Date(Date.now() + 86400000).toISOString() }), false);
});

test('date formatters', () => {
    assert.equal(formatUploadedAt(''), 'Unknown');
    assert.equal(formatUploadedAt('garbage'), 'Unknown');
    assert.match(formatUploadedAt('2026-10-07T12:00:00Z'), /2026/);
    assert.equal(formatSkinReleaseDate('2020'), '2020');
    assert.equal(formatSkinReleaseDate('2026-02-31'), '2026-02-31');
    assert.match(formatSkinReleaseDate('2026-10-07'), /2026/);
});

test('external items and media urls', () => {
    assert.equal(isExternalItem({ source: 'external_link' }), true);
    assert.equal(isExternalItem({ type: 'external' }), true);
    assert.equal(isExternalItem({ source: 'asset' }), false);
    assert.equal(resolveMediaUrl({ url: 'a/b.jpg' }), 'https://assets.timfernix.dev/a/b.jpg');
    assert.equal(resolveMediaUrl({ source: 'external_link', url: 'https://x.y/z' }), 'https://x.y/z');
});

test('YouTube helpers', () => {
    assert.equal(getYouTubeVideoId('https://youtu.be/abc123'), 'abc123');
    assert.equal(getYouTubeVideoId('https://www.youtube.com/watch?v=abc123'), 'abc123');
    assert.equal(getYouTubeVideoId('https://www.youtube.com/embed/abc123'), 'abc123');
    assert.equal(getYouTubeVideoId('not a url'), null);
    assert.equal(getYouTubeEmbedUrl('https://youtu.be/abc123'), 'https://www.youtube.com/embed/abc123');
    assert.equal(getYouTubeEmbedUrl(''), null);
});

test('getExternalPreviewImageUrl', () => {
    const yt = { source: 'external_link', platform: 'youtube', url: 'https://youtu.be/abc123' };
    assert.equal(getExternalPreviewImageUrl(yt), 'https://img.youtube.com/vi/abc123/hqdefault.jpg');
    const gif = { source: 'external_link', platform: 'tenor', url: 'https://t.co/a.gif' };
    assert.equal(getExternalPreviewImageUrl(gif), 'https://t.co/a.gif');
    assert.equal(getExternalPreviewImageUrl({ source: 'external_link', platform: '', url: 'https://x.y/page' }), null);
});

test('escapeHtml', () => {
    assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    assert.equal(escapeHtml(null), '');
});
