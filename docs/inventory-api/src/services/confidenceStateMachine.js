const STATES = {
  PHOTO_ONLY:          'photo_only',
  DRAFT_PHOTO:         'draft_photo',
  IMPORTED_UNVERIFIED: 'imported_unverified',
  MANUALLY_ENTERED:    'manually_entered',
  COUNT_VERIFIED:      'count_verified',
  SALES_RECONCILED:    'sales_reconciled',
  CONFLICT_DETECTED:   'conflict_detected',
};

const TRIGGERS = {
  PHOTO_CAPTURED:    'photo_captured',
  NAME_ADDED:        'name_added',
  QUANTITY_ADDED:    'quantity_added',
  IMPORTED:          'imported',
  MANUAL_ENTRY:      'manual_entry',
  COUNT_RECORDED:    'count_recorded',
  SALE_RECORDED:     'sale_recorded',
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED: 'conflict_resolved',
};

/**
 * Apply a trigger to the current state and return the new state.
 *
 * @param {string} trigger - one of TRIGGERS.*
 * @param {string} currentState - one of STATES.*
 * @param {string|null} preConflictState - stored when entering conflict_detected
 * @returns {{ newState: string, newPreConflictState: string|null }}
 * @throws if the transition is not valid
 */
function transition(trigger, currentState, preConflictState = null) {
  // ── Conflict paths (work from any state) ──────────────────────────────────

  if (trigger === TRIGGERS.CONFLICT_DETECTED) {
    if (currentState === STATES.CONFLICT_DETECTED) {
      // Already conflicted — keep the stored pre-conflict state unchanged
      return { newState: STATES.CONFLICT_DETECTED, newPreConflictState: preConflictState };
    }
    return { newState: STATES.CONFLICT_DETECTED, newPreConflictState: currentState };
  }

  if (trigger === TRIGGERS.CONFLICT_RESOLVED) {
    if (currentState !== STATES.CONFLICT_DETECTED) {
      throw new Error(
        `conflict_resolved requires conflict_detected state (current: ${currentState})`
      );
    }
    if (!preConflictState) {
      throw new Error('conflict_resolved: no pre_conflict_state recorded on this lot');
    }
    return { newState: preConflictState, newPreConflictState: null };
  }

  // ── All other triggers are blocked while in conflict_detected ─────────────

  if (currentState === STATES.CONFLICT_DETECTED) {
    throw new Error(
      `Trigger "${trigger}" is not allowed while in conflict_detected. Resolve the conflict first.`
    );
  }

  // ── Normal forward transitions ────────────────────────────────────────────

  switch (trigger) {
    case TRIGGERS.PHOTO_CAPTURED:
      return { newState: STATES.PHOTO_ONLY, newPreConflictState: null };

    case TRIGGERS.NAME_ADDED:
      if (currentState !== STATES.PHOTO_ONLY) {
        throw new Error(
          `name_added requires photo_only state (current: ${currentState})`
        );
      }
      return { newState: STATES.DRAFT_PHOTO, newPreConflictState: null };

    case TRIGGERS.QUANTITY_ADDED:
      if (currentState !== STATES.DRAFT_PHOTO) {
        throw new Error(
          `quantity_added requires draft_photo state (current: ${currentState})`
        );
      }
      return { newState: STATES.MANUALLY_ENTERED, newPreConflictState: null };

    case TRIGGERS.IMPORTED:
      return { newState: STATES.IMPORTED_UNVERIFIED, newPreConflictState: null };

    case TRIGGERS.MANUAL_ENTRY:
      return { newState: STATES.MANUALLY_ENTERED, newPreConflictState: null };

    case TRIGGERS.COUNT_RECORDED: {
      const allowed = [
        STATES.PHOTO_ONLY,
        STATES.DRAFT_PHOTO,
        STATES.IMPORTED_UNVERIFIED,
        STATES.MANUALLY_ENTERED,
        STATES.SALES_RECONCILED,
      ];
      if (!allowed.includes(currentState)) {
        throw new Error(
          `count_recorded is not valid from state: ${currentState} (allowed: ${allowed.join(', ')})`
        );
      }
      return { newState: STATES.COUNT_VERIFIED, newPreConflictState: null };
    }

    case TRIGGERS.SALE_RECORDED:
      if (currentState !== STATES.COUNT_VERIFIED) {
        throw new Error(
          `sale_recorded requires count_verified state (current: ${currentState})`
        );
      }
      return { newState: STATES.SALES_RECONCILED, newPreConflictState: null };

    default:
      throw new Error(`Unknown trigger: ${trigger}`);
  }
}

/**
 * When a StockLot is PATCHed, determine what trigger (if any) to apply.
 * The route handler passes the incoming patch fields; this function
 * decides what state transition they imply.
 *
 * Returns null when no state change is needed.
 */
function inferTrigger(currentState, patch) {
  // Explicit override always wins
  if (patch.trigger) return patch.trigger;

  const settingName = patch.productName != null && patch.productName !== '';
  const settingQuantity = patch.quantity != null;

  if (currentState === STATES.PHOTO_ONLY) {
    if (settingName && settingQuantity) return TRIGGERS.MANUAL_ENTRY;
    if (settingName) return TRIGGERS.NAME_ADDED;
  }

  if (currentState === STATES.DRAFT_PHOTO) {
    if (settingQuantity) return TRIGGERS.QUANTITY_ADDED;
  }

  return null;
}

module.exports = { STATES, TRIGGERS, transition, inferTrigger };
