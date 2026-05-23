import fs from 'fs';
import ReconciliationRun from '../models/ReconciliationRun.js';
import ReconciliationReport from '../models/ReconciliationReport.js';
import { ingestCSV } from '../services/ingestionService.js';
import { runMatching } from '../services/matchingEngine.js';

const reconcile = async (req, res) => {
  const userFile = req.files?.userFile?.[0];
  const exchangeFile = req.files?.exchangeFile?.[0];

  if (!userFile || !exchangeFile) {
    return res.status(400).json({ error: 'Both userFile and exchangeFile are required' });
  }

  const timestampToleranceSeconds = Number(
    req.body.timestampToleranceSeconds ?? process.env.TIMESTAMP_TOLERANCE_SECONDS ?? 300
  );
  const quantityTolerancePct = Number(
    req.body.quantityTolerancePct ?? process.env.QUANTITY_TOLERANCE_PCT ?? 0.01
  );

  const run = await ReconciliationRun.create({
    status: 'running',
    config: { timestampToleranceSeconds, quantityTolerancePct },
  });

  try {
    await Promise.all([
      ingestCSV(userFile.path, 'user', run._id),
      ingestCSV(exchangeFile.path, 'exchange', run._id),
    ]);

    const { reportEntries, totalUser, totalExchange } = await runMatching(run.config, run._id);

    await ReconciliationReport.insertMany(
      reportEntries.map((entry) => ({ ...entry, runId: run._id }))
    );

    const summary = {
      totalUser,
      totalExchange,
      matched: reportEntries.filter((e) => e.category === 'matched').length,
      conflicting: reportEntries.filter((e) => e.category === 'conflicting').length,
      unmatchedUser: reportEntries.filter((e) => e.category === 'unmatched_user').length,
      unmatchedExchange: reportEntries.filter((e) => e.category === 'unmatched_exchange').length,
    };

    await ReconciliationRun.findByIdAndUpdate(run._id, {
      status: 'completed',
      summary,
      completedAt: new Date(),
    });

    return res.status(200).json({ runId: run._id, summary });
  } catch (err) {
    await ReconciliationRun.findByIdAndUpdate(run._id, {
      status: 'failed',
      error: err.message,
    });
    throw err;
  } finally {
    fs.unlink(userFile.path, () => {});
    fs.unlink(exchangeFile.path, () => {});
  }
};

const getReport = async (req, res) => {
  const run = await ReconciliationRun.findById(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const entries = await ReconciliationReport.find({ runId: run._id }).lean();
  return res.json({ runId: run._id, status: run.status, config: run.config, entries });
};

const getReportSummary = async (req, res) => {
  const run = await ReconciliationRun.findById(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  return res.json({ runId: run._id, status: run.status, summary: run.summary });
};

const getUnmatched = async (req, res) => {
  const run = await ReconciliationRun.findById(req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const entries = await ReconciliationReport.find({
    runId: run._id,
    category: { $in: ['unmatched_user', 'unmatched_exchange'] },
  }).lean();

  return res.json({ runId: run._id, entries });
};

export { reconcile, getReport, getReportSummary, getUnmatched };
