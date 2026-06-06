const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const brandRoutes = require('./routes/brands');
const productRoutes = require('./routes/products');
const stockLotRoutes = require('./routes/stockLots');
const storageRoutes = require('./routes/storage');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/brands', brandRoutes);
app.use('/products', productRoutes);
app.use('/stock-lots', stockLotRoutes);
app.use('/storage', storageRoutes);

app.use(errorHandler);

module.exports = app;
