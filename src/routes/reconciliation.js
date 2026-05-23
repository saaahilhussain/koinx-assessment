import { Router } from 'express';
import upload from '../config/multer.js';
import {
  reconcile,
  getReport,
  getReportSummary,
  getUnmatched,
} from '../controllers/reconciliationController.js';

const router = Router();

router.post(
  '/reconcile',
  upload.fields([{ name: 'userFile', maxCount: 1 }, { name: 'exchangeFile', maxCount: 1 }]),
  reconcile
);

router.get('/report/:runId', getReport);
router.get('/report/:runId/summary', getReportSummary);
router.get('/report/:runId/unmatched', getUnmatched);

export default router;
