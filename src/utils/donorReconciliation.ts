import { normalizePhoneNumber } from './donationAggregator';

export interface DonorAliasMap {
  /** Maps secondary/alternate 10-digit phone numbers to primary 10-digit phone number */
  phoneLinks: Record<string, string>;
  /** Maps normalized name strings to primary 10-digit phone number */
  nameLinks: Record<string, string>;
  /** Custom primary name overrides for phone numbers */
  primaryNames: Record<string, string>;
}

const ALIAS_MAP_KEY = 'yatheem_donor_alias_map_v1';

export function loadDonorAliasMap(): DonorAliasMap {
  try {
    const raw = localStorage.getItem(ALIAS_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        phoneLinks: parsed.phoneLinks || {},
        nameLinks: parsed.nameLinks || {},
        primaryNames: parsed.primaryNames || {},
      };
    }
  } catch (e) {
    console.error('Failed to load donor alias map', e);
  }
  return { phoneLinks: {}, nameLinks: {}, primaryNames: {} };
}

export function saveDonorAliasMap(map: DonorAliasMap): void {
  try {
    localStorage.setItem(ALIAS_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save donor alias map', e);
  }
}

/**
 * Returns the canonical 10-digit phone number for a given raw phone string.
 * Resolves phone links recursively (e.g. phone B -> phone A).
 */
export function getCanonicalPhoneNumber(rawPhone: string, map: DonorAliasMap): string {
  let normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) return '';

  const visited = new Set<string>();
  while (map.phoneLinks[normalized] && !visited.has(normalized)) {
    visited.add(normalized);
    normalized = map.phoneLinks[normalized];
  }
  return normalized;
}

/**
 * Normalizes a donor name for similarity comparisons (lowercase, stripped punctuation)
 */
export function normalizeNameForComparison(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(mr|mrs|dr|al-haj|hajee|shaikh|sayyid|thangal)\.?\s+/g, '') // remove honorifics
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PotentialDuplicateGroup {
  id: string;
  reason: 'same_name' | 'similar_phone' | 'care_of_match';
  primaryCandidatePhone: string;
  secondaryPhone: string;
  primaryName: string;
  secondaryName: string;
  similarityScore: number;
}

/**
 * Scans donor records and returns potential duplicate pairs for admin review
 */
export function findPotentialDuplicates(
  donorRecords: { phoneNumber: string; donorName: string; careOf: string }[],
  aliasMap: DonorAliasMap
): PotentialDuplicateGroup[] {
  const duplicates: PotentialDuplicateGroup[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < donorRecords.length; i++) {
    for (let j = i + 1; j < donorRecords.length; j++) {
      const d1 = donorRecords[i];
      const d2 = donorRecords[j];

      if (d1.phoneNumber === d2.phoneNumber) continue;

      // Skip if already linked
      const c1 = getCanonicalPhoneNumber(d1.phoneNumber, aliasMap);
      const c2 = getCanonicalPhoneNumber(d2.phoneNumber, aliasMap);
      if (c1 === c2) continue;

      const pairKey = [d1.phoneNumber, d2.phoneNumber].sort().join('_');
      if (seenPairs.has(pairKey)) continue;

      const n1 = normalizeNameForComparison(d1.donorName);
      const n2 = normalizeNameForComparison(d2.donorName);

      // Check 1: Exact normalized name match across different phone numbers
      if (n1 && n2 && n1 === n2 && n1.length > 3) {
        seenPairs.add(pairKey);
        duplicates.push({
          id: pairKey,
          reason: 'same_name',
          primaryCandidatePhone: d1.phoneNumber,
          secondaryPhone: d2.phoneNumber,
          primaryName: d1.donorName,
          secondaryName: d2.donorName,
          similarityScore: 0.95,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Merges secondary phone number into primary phone number in the alias map
 */
export function mergeDonorPhones(
  primaryPhone: string,
  secondaryPhone: string,
  map: DonorAliasMap,
  preferredName?: string
): DonorAliasMap {
  const pNorm = normalizePhoneNumber(primaryPhone);
  const sNorm = normalizePhoneNumber(secondaryPhone);

  if (!pNorm || !sNorm || pNorm === sNorm) return map;

  const newMap: DonorAliasMap = {
    phoneLinks: { ...map.phoneLinks, [sNorm]: pNorm },
    nameLinks: { ...map.nameLinks },
    primaryNames: { ...map.primaryNames },
  };

  if (preferredName) {
    newMap.primaryNames[pNorm] = preferredName;
  }

  saveDonorAliasMap(newMap);
  return newMap;
}

/**
 * Removes a phone link
 */
export function unlinkDonorPhone(
  secondaryPhone: string,
  map: DonorAliasMap
): DonorAliasMap {
  const sNorm = normalizePhoneNumber(secondaryPhone);
  const newPhoneLinks = { ...map.phoneLinks };
  delete newPhoneLinks[sNorm];

  const newMap: DonorAliasMap = {
    ...map,
    phoneLinks: newPhoneLinks,
  };
  saveDonorAliasMap(newMap);
  return newMap;
}
