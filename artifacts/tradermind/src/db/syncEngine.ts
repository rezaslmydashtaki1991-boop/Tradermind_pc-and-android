import { db } from './database';
import { runAsRemote, SYNC_META_TABLES } from './syncSupport';
import { stripBlobs, prepareRow, markPendingBlobs } from './syncBlobs';

export interface Tombstone {
  id: string;
  table: string;
  key: any;
  deletedAt: number;
}

export interface SyncPayload {
  deviceId: string;
  since: number;
  until: number;
  rows: Record<string, any[]>;
  tombstones: Tombstone[];
}

export interface ApplyStats {
  inserted: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: number;
}

const metaTable = () => db.table('syncMeta');
const tombTable = () => db.table('syncTombstones');

export async function getDeviceId(): Promise<string> {
  const rec = await metaTable().get('deviceId');
  if (rec?.value) return rec.value as string;
  const id = crypto.randomUUID();
  await metaTable().put({ key: 'deviceId', value: id });
  return id;
}

export async function getLastSync(peerId: string): Promise<number> {
  const rec = await metaTable().get(`lastSync:${peerId}`);
  return typeof rec?.value === 'number' ? rec.value : 0;
}

export async function setLastSync(peerId: string, ts: number): Promise<void> {
  await metaTable().put({ key: `lastSync:${peerId}`, value: ts });
}

/** همه تغییرات (رکورد + حذف) بعد از زمان since */
export async function collectChanges(since: number): Promise<SyncPayload> {
  const until = Date.now();
  const rows: Record<string, any[]> = {};
  for (const t of db.tables) {
    if (SYNC_META_TABLES.includes(t.name)) continue;
    const list = await t
      .filter((r: any) => typeof r.updatedAt === 'number' && r.updatedAt > since)
      .toArray();
    if (list.length) rows[t.name] = stripBlobs(t.name, list);
  }
  const tombstones = (await tombTable().where('deletedAt').above(since).toArray()) as Tombstone[];
  return { deviceId: await getDeviceId(), since, until, rows, tombstones };
}

/** ادغام تغییرات دستگاه دیگر؛ قانون: updatedAt جدیدتر برنده است */
export async function applyChanges(payload: SyncPayload): Promise<ApplyStats> {
  const stats: ApplyStats = { inserted: 0, updated: 0, deleted: 0, skipped: 0, failed: 0 };

  await runAsRemote(async () => {
    await db.transaction('rw', db.tables, async () => {
      // ۱) رکوردها
      for (const [name, list] of Object.entries(payload.rows)) {
        if (SYNC_META_TABLES.includes(name)) continue;
        const table = db.tables.find(t => t.name === name);
        if (!table) { stats.skipped += list.length; continue; }
        const keyPath = table.schema.primKey.keyPath as string;

        for (const row of list) {
          try {
            const key = row[keyPath];
            const tomb = (await tombTable().get(`${name}:${String(key)}`)) as Tombstone | undefined;
            if (tomb && tomb.deletedAt >= row.updatedAt) { stats.skipped++; continue; }

            const local = await table.get(key);
            if (!local) {
              await table.put(prepareRow(name, row, local));
              await markPendingBlobs(name, key, row, local);
              stats.inserted++;
            } else if ((local.updatedAt ?? 0) < row.updatedAt) {
              await table.put(prepareRow(name, row, local));
              await markPendingBlobs(name, key, row, local);
              stats.updated++;
            } else {
              stats.skipped++;
              continue;
            }
            if (tomb) await tombTable().delete(tomb.id); // رکورد زنده‌تر از حذف قدیمی است
          } catch (e) {
            console.warn('[sync] row failed', name, e);
            stats.failed++;
          }
        }
      }

      // ۲) حذف‌ها
      for (const tomb of payload.tombstones) {
        const table = db.tables.find(t => t.name === tomb.table);
        if (!table || SYNC_META_TABLES.includes(tomb.table)) { stats.skipped++; continue; }
        try {
          const local = await table.get(tomb.key);
          if (local && (local.updatedAt ?? 0) > tomb.deletedAt) { stats.skipped++; continue; }
          if (local) { await table.delete(tomb.key); stats.deleted++; }
          const existing = (await tombTable().get(tomb.id)) as Tombstone | undefined;
          if (!existing || existing.deletedAt < tomb.deletedAt) await tombTable().put(tomb);
        } catch (e) {
          console.warn('[sync] tombstone failed', tomb.id, e);
          stats.failed++;
        }
      }
    });
  });

  return stats;
}
