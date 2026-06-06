async function writeEvent(tx, { brandId, stockLotId, eventType, payload = {}, userId = null }) {
  return tx.inventoryEvent.create({
    data: {
      brandId,
      stockLotId,
      eventType,
      payload,
      createdByUserId: userId,
    },
  });
}

module.exports = { writeEvent };
