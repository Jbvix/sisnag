import lighthouseData from './lighthousesBr.json' with { type: 'json' };

/** @type {typeof lighthouseData.lighthouses} */
export const LIGHTHOUSES_BR = lighthouseData.lighthouses || [];

export const LIGHTHOUSES_META = {
  version: lighthouseData.version,
  updatedAt: lighthouseData.updatedAt,
  source: lighthouseData.source,
  count: lighthouseData.count || LIGHTHOUSES_BR.length,
};
