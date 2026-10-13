import { db } from './database';
import { runAsRemote } from './syncSupport';

/** جدول‌هایی که فیلد Blob دارند */
export const BLOB_FIELDS: Record<string, string[]> = {
  chartScreenshots: ['imageBlob'],
  journalMedia: ['blob'],
};

export interface PendingBlob {
  table: string;
  key: any;
  field: string;
  size: number;
  type: string;
}

const meta = () => db.table('syncMeta');
const pendingKey = (t: string, k: any, f: string) => `pendingBlob:${t}:${String(k)}:${f}`;

/** حذف Blob از رکوردها قبل از ارسال؛ فقط اندازه و نوع می‌ماند */
export function stripBlobs(table: string, rows: any[]): any[] {
  const fields = BLOB_FIELDS[table];
  if (!fields) return rows;
  return rows.map(r => {
    const out: any = { ...r };
    const info: Record<string, { size: number; type: string }> = {};
    for (const f of fields) {
      if (r[f] instanceof Blob) {
        info[f] = { size: r[f].size, type: r[f].type };
        out[f] = null;
      }
    }
    if (Object.keys(info).length) out.__blobs = info;
    return out;
  });
}

/** رکورد دریافتی را برای ذخیره آماده می‌کند؛ Blob محلی تا رسیدن فایل جدید حفظ می‌شود */
export function prepareRow(table: string, row: any, local: any): any {
  const { __blobs, ...clean } = row;
  for (const f of BLOB_FIELDS[table] ?? []) {
    clean[f] = local?.[f] instanceof Blob ? local[f] : null;
  }
  return clean;
}

/** فایل‌هایی که باید از دستگاه مقابل گرفته شوند را در فهرست انتظار ثبت می‌کند */
export async function markPendingBlobs(table: string, key: any, row: any, local: any): Promise<void> {
  const info = row.__blobs as Record<string, { size: number; type: string }> | undefined;
  if (!info) return;
  for (const [field, m] of Object.entries(info)) {
    const have = local?.[field];
    if (have instanceof Blob && have.size === m.size && have.type === m.type) continue;
    await meta().put({
      key: pendingKey(table, key, field),
      value: { table, key, field, size: m.size, type: m.type } as PendingBlob,
    });
  }
}

export async function listPendingBlobs(): Promise<PendingBlob[]> {
  const items = await meta().where('key').startsWith('pendingBlob:').toArray();
  return items.map((i: any) => i.value as PendingBlob);
}

/** خواندن فایل برای ارسال به دستگاه مقابل */
export async function readBlob(table: string, key: any, field: string): Promise<Blob | null> {
  const r = await db.table(table).get(key);
  return r?.[field] instanceof Blob ? r[field] : null;
}

/** ذخیره فایل دریافتی بدون تغییر updatedAt */
export async function writeBlob(table: string, key: any, field: string, blob: Blob): Promise<void> {
  await runAsRemote(async () => {
    await db.table(table).update(key, { [field]: blob });
  });
  await meta().delete(pendingKey(table, key, field));
}
