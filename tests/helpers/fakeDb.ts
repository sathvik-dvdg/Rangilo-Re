/**
 * An in-memory stand-in for the Supabase service-role client, for route tests.
 *
 * It keeps rows per table, records every write, and copies the parts of the
 * schema the payment and consent code relies on: the contact_consents foreign
 * key and unique indexes, the users foreign keys of blocks and reports (0010),
 * and the three functions from migration
 * 0006_contact_consent.sql. Those copies are only as good as their match with
 * the SQL; the SQL itself was run against Postgres separately (see PAY-010 /
 * ID-001 evidence in OBJECTIVES.md). Nothing here talks to a database.
 */
export type Row = Record<string, unknown>;
export type Write = { table: string; op: 'insert' | 'upsert' | 'update' | 'delete'; row: Row };
type DbError = { code: string; message: string };
type Result<T> = { data: T; error: DbError | null };

const DAY_MS = 24 * 60 * 60 * 1000;
const FOREIGN_KEY = { code: '23503', message: 'violates foreign key constraint' };
const UNIQUE = { code: '23505', message: 'duplicate key value violates unique constraint' };

export function createFakeDb() {
  const tables: Record<string, Row[]> = {};
  const writes: Write[] = [];
  const rpcCalls: { fn: string; args: Row }[] = [];
  /** table -> error returned by insert, upsert and update on it. */
  const writeErrors: Record<string, DbError | undefined> = {};
  /** table -> error returned by reads of it; a function gets the selected columns and may return none. */
  const readErrors: Record<string, DbError | ((columns: string) => DbError | null) | undefined> = {};
  /** function name -> error returned by rpc. */
  const rpcErrors: Record<string, DbError | undefined> = {};
  /** Column lists passed to select(), per table. */
  const selected: Record<string, string[]> = {};
  let nextId = 0;

  const rowsOf = (table: string) => (tables[table] ??= []);
  /** Only the selected columns come back, as from PostgREST. */
  const project = (row: Row, columns: string): Row =>
    columns === '*' ? { ...row } : Object.fromEntries(columns.split(',').map((c) => [c.trim(), row[c.trim()] ?? null]));
  const readError = (table: string, columns: string) => {
    const configured = readErrors[table];
    return (typeof configured === 'function' ? configured(columns) : configured) ?? null;
  };
  const isOpen = (row: Row) => row.status === 'pending' || row.status === 'accepted';

  /** What Postgres would refuse, for the tables whose constraints the code depends on. */
  function violation(table: string, row: Row): DbError | null {
    // Migration 0010: both columns reference users.clerk_id.
    const userColumns = table === 'blocks' ? ['blocker_id', 'blocked_id'] : table === 'reports' ? ['reporter_id', 'reported_id'] : [];
    if (userColumns.some((c) => !rowsOf('users').some((u) => u.clerk_id === row[c]))) return FOREIGN_KEY;
    if (table !== 'contact_consents') return null;
    if (!rowsOf('rooms').some((r) => r.id === row.room_id)) return FOREIGN_KEY;
    const sameRoom = rowsOf(table).filter((r) => r.room_id === row.room_id);
    if (sameRoom.some((r) => r.requester_id === row.requester_id)) return UNIQUE;
    if (sameRoom.some(isOpen)) return UNIQUE;
    return null;
  }

  function store(table: string, row: Row) {
    const defaults: Row =
      table === 'contact_consents'
        ? { status: 'pending', requested_at: new Date().toISOString(), responded_at: null }
        : table === 'payment_orders'
          ? { payment_id: null }
          : table === 'rooms'
            ? { timer_started_at: null, unlimited: false }
            : {};
    const stored = { id: `${table}_${++nextId}`, ...defaults, ...row };
    rowsOf(table).push(stored);
    return stored;
  }

  function write(table: string, op: 'insert' | 'upsert', row: Row, conflictColumn?: string) {
    let stored: Row | null = null;
    let error: DbError | null = writeErrors[table] ?? null;
    if (!error) {
      // onConflict may name several columns ("a,b"): a conflict is a row equal on all of them.
      const keys = conflictColumn?.split(',').map((c) => c.trim()) ?? [];
      const existing = keys.length ? rowsOf(table).find((r) => keys.every((k) => r[k] === row[k])) : undefined;
      if (existing) {
        stored = existing; // on conflict do nothing
      } else {
        error = violation(table, row);
        if (!error) {
          writes.push({ table, op, row });
          stored = store(table, row);
        }
      }
    }
    const one = (columns: string) => async (): Promise<Result<Row | null>> => {
      const failed = error ?? readError(table, columns);
      return { data: failed || !stored ? null : project(stored, columns), error: failed };
    };
    return {
      select: (columns = '*') => ({ single: one(columns), maybeSingle: one(columns) }),
      then: <T>(resolve: (result: { error: DbError | null }) => T) => Promise.resolve({ error }).then(resolve),
    };
  }

  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let update: Row | null = null;
    let remove = false;
    let sortBy: { column: string; ascending: boolean } | null = null;
    let columns = '*';
    const matching = () => {
      const found = rowsOf(table).filter((row) => filters.every((f) => f(row)));
      if (!sortBy) return found;
      const { column, ascending } = sortBy;
      return [...found].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
    };
    const read = <T>(data: () => T, empty: T): Result<T> => {
      const error = readError(table, columns);
      return { data: error ? empty : data(), error };
    };
    const first = () => {
      const row = matching()[0];
      return row ? project(row, columns) : null;
    };
    const query = {
      select: (cols = '*') => ((columns = cols), (selected[table] ??= []).push(cols), query),
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), query),
      neq: (column: string, value: unknown) => (filters.push((row) => row[column] !== value), query),
      in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), query),
      is: (column: string, value: unknown) => (filters.push((row) => (row[column] ?? null) === value), query),
      order: (column: string, options: { ascending?: boolean } = {}) => ((sortBy = { column, ascending: options.ascending !== false }), query),
      limit: () => query,
      maybeSingle: async () => read<Row | null>(first, null),
      single: async () => read<Row | null>(first, null),
      insert: (row: Row) => write(table, 'insert', row),
      upsert: (row: Row, options: { onConflict?: string } = {}) => write(table, 'upsert', row, options.onConflict),
      update: (values: Row) => ((update = values), query),
      delete: () => ((remove = true), query),
      // Awaiting the builder runs the read, the update or the delete, as the Supabase client does.
      then: <T>(resolve: (result: Result<Row[] | null>) => T) => {
        if (remove) {
          const failed = writeErrors[table] ?? null;
          if (failed) return Promise.resolve({ data: null, error: failed }).then(resolve);
          const gone = matching();
          tables[table] = rowsOf(table).filter((row) => !gone.includes(row));
          for (const row of gone) writes.push({ table, op: 'delete', row });
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        const values = update;
        if (!values) return Promise.resolve(read<Row[] | null>(() => matching().map((row) => project(row, columns)), null)).then(resolve);
        const failed = writeErrors[table] ?? null;
        if (failed) return Promise.resolve({ data: null, error: failed }).then(resolve);
        const changed = matching();
        for (const row of changed) {
          Object.assign(row, values);
          writes.push({ table, op: 'update', row: values });
        }
        // With .select(), an update returns the rows it changed.
        return Promise.resolve({ data: changed.map((row) => project(row, columns)), error: null }).then(resolve);
      },
    };
    return query;
  };

  // The functions from migration 0006. Each is one transaction in Postgres. None of them
  // touches rooms.unlimited or the order: the payment sets the first, and no answer refunds.
  const functions: Record<string, (args: Row) => unknown> = {
    accept_contact_consent: ({ p_consent_id, p_partner_id }) => {
      const consent = rowsOf('contact_consents').find(
        (c) => c.id === p_consent_id && c.partner_id === p_partner_id && c.status === 'pending' && Date.now() - Date.parse(String(c.requested_at)) < DAY_MS,
      );
      if (!consent) return false;
      Object.assign(consent, { status: 'accepted', responded_at: new Date().toISOString() });
      const pair = [String(consent.requester_id), String(consent.partner_id)].sort();
      store('contact_reveals', { room_id: consent.room_id, user_a_id: pair[0], user_b_id: pair[1], consent_id: consent.id });
      return true;
    },
    decline_contact_consent: ({ p_consent_id, p_partner_id }) => {
      const consent = rowsOf('contact_consents').find((c) => c.id === p_consent_id && c.partner_id === p_partner_id && c.status === 'pending');
      if (!consent) return false;
      Object.assign(consent, { status: 'declined', responded_at: new Date().toISOString() });
      return true;
    },
    expire_contact_consents: ({ p_room_id }) => {
      const stale = rowsOf('contact_consents').filter(
        (c) => c.status === 'pending' && Date.now() - Date.parse(String(c.requested_at)) >= DAY_MS && (p_room_id == null || c.room_id === p_room_id),
      );
      for (const consent of stale) consent.status = 'expired';
      return stale.length;
    },
  };

  const rpc = async (fn: string, args: Row = {}): Promise<Result<unknown>> => {
    rpcCalls.push({ fn, args });
    const error = rpcErrors[fn] ?? null;
    return { data: error ? null : functions[fn](args), error };
  };

  return {
    /** What `supabaseAdmin()` returns. */
    client: { from, rpc },
    tables,
    rowsOf,
    writes,
    writesTo: (table: string) => writes.filter((w) => w.table === table),
    rpcCalls,
    writeErrors,
    readErrors,
    rpcErrors,
    selected,
    /** Adds a row directly, skipping the constraint checks and the write log. */
    seed: (table: string, row: Row) => store(table, row),
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
