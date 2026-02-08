
import { SaveData } from '../types';

const STORAGE_KEY = 'gooptris_save_v3';
const LEGACY_KEY_V2 = 'gooptris_save_v2';

export const getDefaultSaveData = (): SaveData => ({
  careerRank: 1,
  careerScore: 0,
  scraps: 0,
  powerUps: {},
  equippedActives: [],      // No actives equipped by default
  unlockedUpgrades: [],     // No upgrades revealed yet (first at rank 1)
  firstRunComplete: false,
  milestonesReached: [],
  tutorialProgress: { completedSteps: [] },
  settings: {
    masterVolume: 50,
    musicVolume: 80,
    sfxVolume: 100,
    invertRotation: false
  }
});

/**
 * Migrate v2 save data (operatorXP/operatorRank) to v3 (careerScore/careerRank)
 */
const migrateV2toV3 = (v2Data: Record<string, unknown>): Record<string, unknown> => {
  const migrated: Record<string, unknown> = { ...v2Data };

  // Rename operatorXP → careerScore
  if ('operatorXP' in migrated) {
    migrated.careerScore = migrated.operatorXP;
    delete migrated.operatorXP;
  }

  // Rename operatorRank → careerRank
  if ('operatorRank' in migrated) {
    migrated.careerRank = migrated.operatorRank;
    delete migrated.operatorRank;
  }

  return migrated;
};

export const loadSaveData = (): SaveData => {
  try {
    // Try loading v3 first
    let raw = localStorage.getItem(STORAGE_KEY);
    const defaults = getDefaultSaveData();

    // If no v3 data, check for v2 migration
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_KEY_V2);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        const migrated = migrateV2toV3(legacyParsed);

        // Save as v3 and remove v2
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY_V2);

        raw = JSON.stringify(migrated);
      }
    }

    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    // Merge with default to handle schema updates/missing keys
    return {
        ...defaults,
        ...parsed,
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        powerUps: { ...defaults.powerUps, ...(parsed.powerUps || {}) },
        tutorialProgress: { ...defaults.tutorialProgress, ...(parsed.tutorialProgress || {}) },
        // Arrays: use parsed if exists, otherwise default
        equippedActives: parsed.equippedActives || defaults.equippedActives,
        unlockedUpgrades: parsed.unlockedUpgrades || defaults.unlockedUpgrades,
        milestonesReached: parsed.milestonesReached || defaults.milestonesReached
    };
  } catch (e) {
    console.error("Failed to load save data", e);
    return getDefaultSaveData();
  }
};

export const saveGameData = (data: SaveData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};

export const clearSaveData = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const wipeSaveData = (): SaveData => {
  const fresh = getDefaultSaveData();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch (e) {
    console.error("Failed to wipe save data", e);
  }
  return fresh;
};
