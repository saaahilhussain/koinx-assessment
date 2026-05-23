import 'dotenv/config';
import express from 'express';
import connectDB from './config/db.js';
import reconciliationRoutes from './routes/reconciliation.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/', reconciliationRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

export default app;
