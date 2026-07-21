const { STATES, TRIGGERS, transition, inferTrigger } = require('../services/confidenceStateMachine');

describe('confidence state machine — transition()', () => {
  describe('PHOTO_CAPTURED', () => {
    test('always produces photo_only regardless of current state', () => {
      for (const state of [STATES.MANUALLY_ENTERED, STATES.COUNT_VERIFIED, STATES.SALES_RECONCILED]) {
        const { newState } = transition(TRIGGERS.PHOTO_CAPTURED, state);
        expect(newState).toBe(STATES.PHOTO_ONLY);
      }
    });
    test('clears preConflictState', () => {
      const { newPreConflictState } = transition(TRIGGERS.PHOTO_CAPTURED, STATES.PHOTO_ONLY);
      expect(newPreConflictState).toBeNull();
    });
  });

  describe('NAME_ADDED', () => {
    test('photo_only → draft_photo', () => {
      const { newState } = transition(TRIGGERS.NAME_ADDED, STATES.PHOTO_ONLY);
      expect(newState).toBe(STATES.DRAFT_PHOTO);
    });
    test('throws from draft_photo', () => {
      expect(() => transition(TRIGGERS.NAME_ADDED, STATES.DRAFT_PHOTO)).toThrow(/photo_only/);
    });
    test('throws from manually_entered', () => {
      expect(() => transition(TRIGGERS.NAME_ADDED, STATES.MANUALLY_ENTERED)).toThrow();
    });
  });

  describe('QUANTITY_ADDED', () => {
    test('draft_photo → manually_entered', () => {
      const { newState } = transition(TRIGGERS.QUANTITY_ADDED, STATES.DRAFT_PHOTO);
      expect(newState).toBe(STATES.MANUALLY_ENTERED);
    });
    test('throws from photo_only', () => {
      expect(() => transition(TRIGGERS.QUANTITY_ADDED, STATES.PHOTO_ONLY)).toThrow(/draft_photo/);
    });
    test('throws from manually_entered', () => {
      expect(() => transition(TRIGGERS.QUANTITY_ADDED, STATES.MANUALLY_ENTERED)).toThrow();
    });
  });

  describe('IMPORTED', () => {
    test('produces imported_unverified from any non-conflict state', () => {
      const states = [
        STATES.PHOTO_ONLY, STATES.DRAFT_PHOTO, STATES.MANUALLY_ENTERED,
        STATES.COUNT_VERIFIED, STATES.SALES_RECONCILED,
      ];
      for (const state of states) {
        const { newState } = transition(TRIGGERS.IMPORTED, state);
        expect(newState).toBe(STATES.IMPORTED_UNVERIFIED);
      }
    });
  });

  describe('MANUAL_ENTRY', () => {
    test('produces manually_entered from any non-conflict state', () => {
      const { newState } = transition(TRIGGERS.MANUAL_ENTRY, STATES.PHOTO_ONLY);
      expect(newState).toBe(STATES.MANUALLY_ENTERED);
    });
    test('produces manually_entered from imported_unverified', () => {
      const { newState } = transition(TRIGGERS.MANUAL_ENTRY, STATES.IMPORTED_UNVERIFIED);
      expect(newState).toBe(STATES.MANUALLY_ENTERED);
    });
  });

  describe('COUNT_RECORDED', () => {
    const allowed = [
      STATES.PHOTO_ONLY, STATES.DRAFT_PHOTO, STATES.IMPORTED_UNVERIFIED,
      STATES.MANUALLY_ENTERED, STATES.SALES_RECONCILED,
    ];
    test.each(allowed)('produces count_verified from %s', (state) => {
      const { newState } = transition(TRIGGERS.COUNT_RECORDED, state);
      expect(newState).toBe(STATES.COUNT_VERIFIED);
    });
    test('throws from count_verified (already verified)', () => {
      expect(() => transition(TRIGGERS.COUNT_RECORDED, STATES.COUNT_VERIFIED)).toThrow();
    });
  });

  describe('SALE_RECORDED', () => {
    test('count_verified → sales_reconciled', () => {
      const { newState } = transition(TRIGGERS.SALE_RECORDED, STATES.COUNT_VERIFIED);
      expect(newState).toBe(STATES.SALES_RECONCILED);
    });
    test('throws from manually_entered', () => {
      expect(() => transition(TRIGGERS.SALE_RECORDED, STATES.MANUALLY_ENTERED)).toThrow(/count_verified/);
    });
    test('throws from imported_unverified', () => {
      expect(() => transition(TRIGGERS.SALE_RECORDED, STATES.IMPORTED_UNVERIFIED)).toThrow();
    });
  });

  describe('CONFLICT_DETECTED', () => {
    test('any state → conflict_detected, stores pre_conflict_state', () => {
      const { newState, newPreConflictState } = transition(TRIGGERS.CONFLICT_DETECTED, STATES.COUNT_VERIFIED);
      expect(newState).toBe(STATES.CONFLICT_DETECTED);
      expect(newPreConflictState).toBe(STATES.COUNT_VERIFIED);
    });
    test('stores photo_only as pre_conflict_state', () => {
      const { newPreConflictState } = transition(TRIGGERS.CONFLICT_DETECTED, STATES.PHOTO_ONLY);
      expect(newPreConflictState).toBe(STATES.PHOTO_ONLY);
    });
    test('already in conflict_detected → keeps existing pre_conflict_state', () => {
      const { newState, newPreConflictState } = transition(
        TRIGGERS.CONFLICT_DETECTED, STATES.CONFLICT_DETECTED, STATES.MANUALLY_ENTERED
      );
      expect(newState).toBe(STATES.CONFLICT_DETECTED);
      expect(newPreConflictState).toBe(STATES.MANUALLY_ENTERED);
    });
  });

  describe('CONFLICT_RESOLVED', () => {
    test('conflict_detected → restores pre_conflict_state', () => {
      const { newState, newPreConflictState } = transition(
        TRIGGERS.CONFLICT_RESOLVED, STATES.CONFLICT_DETECTED, STATES.COUNT_VERIFIED
      );
      expect(newState).toBe(STATES.COUNT_VERIFIED);
      expect(newPreConflictState).toBeNull();
    });
    test('can restore any state', () => {
      for (const state of [STATES.PHOTO_ONLY, STATES.MANUALLY_ENTERED, STATES.SALES_RECONCILED]) {
        const { newState } = transition(TRIGGERS.CONFLICT_RESOLVED, STATES.CONFLICT_DETECTED, state);
        expect(newState).toBe(state);
      }
    });
    test('throws if not currently in conflict_detected', () => {
      expect(() => transition(TRIGGERS.CONFLICT_RESOLVED, STATES.MANUALLY_ENTERED)).toThrow(/conflict_detected/);
    });
    test('throws if pre_conflict_state is null', () => {
      expect(() => transition(TRIGGERS.CONFLICT_RESOLVED, STATES.CONFLICT_DETECTED, null)).toThrow(/pre_conflict_state/);
    });
  });

  describe('triggers blocked in conflict_detected', () => {
    const blocked = [
      TRIGGERS.NAME_ADDED, TRIGGERS.QUANTITY_ADDED, TRIGGERS.MANUAL_ENTRY,
      TRIGGERS.COUNT_RECORDED, TRIGGERS.SALE_RECORDED, TRIGGERS.IMPORTED,
    ];
    test.each(blocked)('%s throws from conflict_detected', (trigger) => {
      expect(() => transition(trigger, STATES.CONFLICT_DETECTED)).toThrow(/conflict/i);
    });
  });

  describe('unknown trigger', () => {
    test('throws', () => {
      expect(() => transition('do_magic', STATES.PHOTO_ONLY)).toThrow(/Unknown trigger/);
    });
  });
});

describe('inferTrigger()', () => {
  test('photo_only + name only → NAME_ADDED', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { productName: 'Blue Kurta' })).toBe(TRIGGERS.NAME_ADDED);
  });
  test('photo_only + name + quantity → MANUAL_ENTRY', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { productName: 'Blue Kurta', quantity: 10 })).toBe(TRIGGERS.MANUAL_ENTRY);
  });
  test('photo_only + quantity only → null (no name, no transition)', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { quantity: 10 })).toBeNull();
  });
  test('draft_photo + quantity → QUANTITY_ADDED', () => {
    expect(inferTrigger(STATES.DRAFT_PHOTO, { quantity: 10 })).toBe(TRIGGERS.QUANTITY_ADDED);
  });
  test('draft_photo + name only → null (name already set)', () => {
    expect(inferTrigger(STATES.DRAFT_PHOTO, { productName: 'Blue Kurta' })).toBeNull();
  });
  test('manually_entered + quantity change → null (no state change)', () => {
    expect(inferTrigger(STATES.MANUALLY_ENTERED, { quantity: 20 })).toBeNull();
  });
  test('explicit trigger field always wins', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { trigger: TRIGGERS.CONFLICT_DETECTED }))
      .toBe(TRIGGERS.CONFLICT_DETECTED);
  });
  test('empty productName string counts as not setting name', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { productName: '' })).toBeNull();
  });
  test('null productName counts as not setting name', () => {
    expect(inferTrigger(STATES.PHOTO_ONLY, { productName: null })).toBeNull();
  });
});
