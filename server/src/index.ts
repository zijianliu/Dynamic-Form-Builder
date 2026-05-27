import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import db from './db';
import userRoutes from './routes/userRoutes';
import formRoutes from './routes/formRoutes';
import submissionRoutes from './routes/submissionRoutes';
import { UPLOAD_DIR } from './config';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', userRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/submissions', submissionRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
