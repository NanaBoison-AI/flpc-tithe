// Minimal in-memory stand-in for the Firestore Admin API surface used by the app.
// Transactions are serialized with a mutex so lock/idempotency logic is genuinely exercised.
type Doc = Record<string, any>;
const cmp = (a: any, b: any) => { const x = a instanceof Date ? a.getTime() : a; const y = b instanceof Date ? b.getTime() : b; return x < y ? -1 : x > y ? 1 : 0; };

export function createFakeDb() {
  const data = new Map<string, Map<string, Doc>>();
  let auto = 0;
  const store = (c: string) => { if (!data.has(c)) data.set(c, new Map()); return data.get(c)!; };
  const snap = (c: string, id: string) => { const d = store(c).get(id); return { id, exists: d !== undefined, data: () => (d ? structuredClone(d) : undefined), ref: docRef(c, id) }; };
  function docRef(c: string, id: string) {
    return {
      id,
      get: async () => snap(c, id),
      set: async (d: Doc, o?: { merge?: boolean }) => { store(c).set(id, o?.merge ? { ...(store(c).get(id) ?? {}), ...d } : { ...d }); },
      create: async (d: Doc) => { if (store(c).has(id)) { const e: any = new Error("ALREADY_EXISTS: already exists"); e.code = 6; throw e; } store(c).set(id, { ...d }); },
      update: async (d: Doc) => { if (!store(c).has(id)) throw new Error("NOT_FOUND"); store(c).set(id, { ...store(c).get(id)!, ...d }); },
    };
  }
  function query(c: string, filters: [string, string, any][] = [], lim = Infinity): any {
    return {
      where: (f: string, op: string, v: any) => query(c, [...filters, [f, op, v]], lim),
      orderBy: () => query(c, filters, lim), select: () => query(c, filters, lim), limit: (n: number) => query(c, filters, n),
      get: async () => {
        const docs = [...store(c).entries()].filter(([, d]) => filters.every(([f, op, v]) => op === "==" ? d[f] === v : op === ">=" ? cmp(d[f], v) >= 0 : op === "<=" ? cmp(d[f], v) <= 0 : op === "<" ? cmp(d[f], v) < 0 : cmp(d[f], v) > 0))
          .slice(0, lim).map(([id]) => snap(c, id));
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  let chain: Promise<unknown> = Promise.resolve();
  const db = {
    collection: (c: string) => ({ doc: (id?: string) => docRef(c, id ?? `auto${++auto}`), add: async (d: Doc) => { const id = `auto${++auto}`; store(c).set(id, { ...d }); return docRef(c, id); }, ...query(c) }),
    runTransaction: (fn: (tx: any) => Promise<any>) => {
      const run = chain.then(() => fn({ get: (r: any) => r.get(), update: (r: any, d: Doc) => r.update(d), set: (r: any, d: Doc) => r.set(d) }));
      chain = run.catch(() => {});
      return run;
    },
    batch: () => { const ops: (() => Promise<void>)[] = []; return { set: (r: any, d: Doc) => ops.push(() => r.set(d)), commit: async () => { for (const o of ops) await o(); } }; },
  };
  return { db, data, store };
}
