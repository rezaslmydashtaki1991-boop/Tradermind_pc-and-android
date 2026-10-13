import JSZip from 'jszip';
import { db } from '../db/database';
import { compressImage } from '../lib/imageCompression';
import { getJournalAnalysisFieldLabels, getJournalAnalysisFieldLayouts } from './journalAnalysisFieldLabels';
import { buildJournalReportParts, type ReportMedia } from './journalWordReportBuilder';

export interface JournalReportRange {
  /** ابتدای بازه (timestamp، شامل). */
  from?: number;
  /** انتهای بازه (timestamp، شامل). */
  to?: number;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * گزارش Word ژورنال: به‌ازای هر روز معاملاتی، جدول معاملات، تحلیل‌های چندبازه‌ای
 * همراه عکس، و معاملات به‌همراه تریگرشان (عکس تریگر بعد از جدول).
 */
export async function buildJournalWordReport(range: JournalReportRange = {}): Promise<{ blob: Blob; sessionCount: number }> {
  const allSessions = await db.journalSessions.toArray();
  const sessions = allSessions.filter(session =>
    (range.from == null || session.startTime >= range.from) && (range.to == null || session.startTime <= range.to));
  const sessionIds = sessions.map(session => session.id);

  const [options, strategies, accounts, analyses, triggers, trades, mediaRecords] = await Promise.all([
    db.journalOptions.toArray(),
    db.strategies.toArray(),
    db.accounts.toArray(),
    db.journalSessionAnalyses.where('sessionId').anyOf(sessionIds).toArray(),
    db.journalTriggerEvents.where('sessionId').anyOf(sessionIds).toArray(),
    db.trades.where('journalSessionId').anyOf(sessionIds).toArray(),
    db.journalMedia.where('sessionId').anyOf(sessionIds).toArray(),
  ]);

  // عکس‌ها یکی‌یکی به JPEG تبدیل می‌شوند (Word از WebP پشتیبانی نمی‌کند) تا حافظهٔ گوشی پر نشود.
  const media: ReportMedia[] = [];
  for (const record of mediaRecords.sort((a, b) => a.createdAt - b.createdAt)) {
    if (!record.mimeType.startsWith('image/') || (!record.analysisId && !record.triggerId)) continue;
    try {
      const converted = await compressImage(record.blob, { maxWidth: 1600, maxHeight: 1600, quality: 0.85, mimeType: 'image/jpeg' });
      media.push({
        id: record.id,
        analysisId: record.analysisId ?? null,
        triggerId: record.triggerId ?? null,
        image: {
          fileName: `${record.id}.jpg`,
          bytes: new Uint8Array(await converted.blob.arrayBuffer()),
          width: converted.width,
          height: converted.height,
        },
      });
    } catch {
      // تصویر نامعتبر یا ناخوانا؛ از گزارش حذف می‌شود و بقیهٔ گزارش ساخته می‌شود.
    }
  }

  const parts = buildJournalReportParts({
    sessions, options, strategies, accounts, analyses, triggers, trades, media,
    labels: getJournalAnalysisFieldLabels(),
    layouts: getJournalAnalysisFieldLayouts(),
    generatedAt: Date.now(),
  });

  const zip = new JSZip();
  for (const [path, content] of Object.entries(parts)) {
    // تصویرها از قبل فشرده‌اند؛ فقط XMLها DEFLATE می‌شوند.
    zip.file(path, content, { compression: typeof content === 'string' ? 'DEFLATE' : 'STORE' });
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
  return { blob, sessionCount: sessions.length };
}
