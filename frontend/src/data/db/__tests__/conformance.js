import { describe, it, expect } from 'vitest';

// Shared contract every adapter must satisfy. `factory` returns a fresh adapter.
export function runAdapterConformance(label, factory) {
  describe(`${label} adapter`, () => {
    it('execs DDL and queries rows back', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, n REAL)');
      await db.run('INSERT INTO t (id, n) VALUES (?, ?)', ['a', 1.5]);
      expect(await db.query('SELECT * FROM t')).toEqual([{ id: 'a', n: 1.5 }]);
      await db.close();
    });

    it('reports the number of changed rows', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)');
      await db.run('INSERT INTO t (id) VALUES (?)', ['a']);
      const result = await db.run('DELETE FROM t WHERE id = ?', ['a']);
      expect(result.changes).toBe(1);
      await db.close();
    });

    it('rolls a failed transaction back', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE t (id TEXT PRIMARY KEY)');
      await expect(
        db.transaction(async () => {
          await db.run('INSERT INTO t (id) VALUES (?)', ['a']);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await db.query('SELECT * FROM t')).toEqual([]);
      await db.close();
    });

    it('enforces foreign keys', async () => {
      const db = await factory();
      await db.exec('CREATE TABLE parent (id TEXT PRIMARY KEY)');
      await db.exec('CREATE TABLE child (id TEXT PRIMARY KEY, pid TEXT REFERENCES parent(id))');
      await expect(db.run('INSERT INTO child (id, pid) VALUES (?, ?)', ['c', 'missing'])).rejects.toThrow();
      await db.close();
    });
  });
}
