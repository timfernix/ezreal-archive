export function getShortAssetPath(item) {
    const id = String(item.databaseId ?? '');
    if (!/^[1-9]\d*$/.test(id)) return null;

    if (item.source === 'asset') return `/a/${id}`;
    if (item.source === 'external_link') return `/e/${id}`;
    return null;
}

export function parseShortAssetPath(pathname) {
    const match = /^\/(a|e)\/([1-9]\d*)\/?$/.exec(pathname);
    if (!match) return null;
    return { source: match[1] === 'a' ? 'asset' : 'external_link', databaseId: match[2] };
}

export function findSharedItem(items, pathname, legacyId) {
    const target = parseShortAssetPath(pathname);
    if (target) {
        return items.find(item => item.source === target.source && String(item.databaseId) === target.databaseId) || null;
    }
    if (!legacyId) return null;
    return items.find(item => item.id === legacyId || `${item.source || 'asset'}:${item.url}` === legacyId) || null;
}
