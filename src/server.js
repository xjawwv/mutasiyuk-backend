import 'dotenv/config.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import v1Routes from './routes/v1.js';
import subscriptionRoutes from './routes/subscription.js';
import internalRoutes from './routes/internal.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { startPoller } from './jobs/poller.js';

const app = express();
const PORT = process.env.PORT || 3000;

await connectDB();

// ⚠️ Jangan pakai `true`, cukup 1 hop atau false
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

app.use(helmet());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ✅ capture rawBody langsung di express.json verify
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(morgan('dev'));

// rate limiter global
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// routes
app.use('/auth', authRoutes);
app.use('/me', meRoutes);
app.use('/v1', v1Routes);
app.use('/internal', internalRoutes);
app.use('/subscription', subscriptionRoutes);

// fallback
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () =>
  console.log(`✅ MutasiYuk v2 (subscription) running :${PORT}`)
);

startPoller();
