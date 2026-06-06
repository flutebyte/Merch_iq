function errorHandler(err, req, res, next) {
  console.error('[error]', err.message, err.code);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'duplicate record', field: err.meta?.target });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'record not found' });
  }

  res.status(500).json({ error: 'internal server error' });
}

module.exports = { errorHandler };
