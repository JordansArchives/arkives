// Arkives — the profile store: the signed-in creator's profile row,
// platforms and rate card. Every other store depends on it, because every
// query is scoped by the profile id it loads.
import { db } from '../lib/sb.js';
import { defineStore } from './_store.js';

export const profile = defineStore('profile', {
  keys: ['CREATOR', 'RATE_CARD'],
  fetch: () => db.sbFetchProfile(),
});
