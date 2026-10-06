// Wedjat RSM integration — queries the Wedjat restaurant database (Turso/libsql)
// directly to fetch tables, products, push orders, sync prices, and detect
// revocations. All credentials are in .env (never hardcoded).
//
// Design principle: this integration is NON-BLOCKING and BEST-EFFORT.
// Mazaj never depends on Wedjat being available to function. All Wedjat
// operations are wrapped in try/catch and logged, never thrown.

import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const url = process.env.WEDJAT_TURSO_URL;
  const token = process.env.WEDJAT_TURSO_TOKEN;
  if (!url || !token) {
    throw new Error("Wedjat Turso credentials not configured");
  }
  _client = createClient({ url, authToken: token });
  return _client;
}

export interface WedjatTable {
  id: number;
  name: string;
  status: string;
}

export interface WedjatProduct {
  id: number;
  name: string;
  nameAr: string | null;
  price: number;
  cost: number;
  categoryId: number | null;
  categoryName: string | null;
  imageUrl: string | null;
  description: string | null;
  active: boolean;
  soldOut: boolean;
  stock: number;
}

export interface WedjatCategory {
  id: number;
  name: string;
  nameAr: string | null;
  displayOrder: number;
}

// --- READ: tables, products, categories ---

export async function fetchWedjatTables(): Promise<WedjatTable[]> {
  const client = getClient();
  const result = await client.execute(
    "SELECT id, name, status FROM tables ORDER BY id"
  );
  return result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    status: row.status as string,
  }));
}

export async function fetchWedjatCategories(): Promise<WedjatCategory[]> {
  const client = getClient();
  const result = await client.execute(
    "SELECT id, name, name_ar, display_order FROM categories ORDER BY display_order"
  );
  return result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    nameAr: (row.name_ar as string) || null,
    displayOrder: row.display_order as number,
  }));
}

export async function fetchWedjatProducts(): Promise<WedjatProduct[]> {
  const client = getClient();
  const result = await client.execute(`
    SELECT p.id, p.name, p.name_ar, p.price, p.cost, p.category_id,
           p.image_url, p.description, p.active, p.sold_out, p.stock,
           c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1 AND p.sold_out = 0
    ORDER BY c.display_order, p.name
  `);
  return result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    nameAr: (row.name_ar as string) || null,
    price: row.price as number,
    cost: row.cost as number,
    categoryId: (row.category_id as number) || null,
    categoryName: (row.category_name as string) || null,
    imageUrl: (row.image_url as string) || null,
    description: (row.description as string) || null,
    active: Boolean(row.active),
    soldOut: Boolean(row.sold_out),
    stock: row.stock as number,
  }));
}

export async function fetchWedjatProductsByCategory(
  categoryName: string
): Promise<WedjatProduct[]> {
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT p.id, p.name, p.name_ar, p.price, p.cost, p.category_id,
                 p.image_url, p.description, p.active, p.sold_out, p.stock,
                 c.name as category_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          WHERE c.name = ? AND p.active = 1 AND p.sold_out = 0
          ORDER BY p.name`,
    args: [categoryName],
  });
  return result.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    nameAr: (row.name_ar as string) || null,
    price: row.price as number,
    cost: row.cost as number,
    categoryId: (row.category_id as number) || null,
    categoryName: (row.category_name as string) || null,
    imageUrl: (row.image_url as string) || null,
    description: (row.description as string) || null,
    active: Boolean(row.active),
    soldOut: Boolean(row.sold_out),
    stock: row.stock as number,
  }));
}

// --- WRITE: push order to Wedjat (with idempotency) ---

export interface PushOrderResult {
  ok: boolean;
  wedjatOrderId?: number;
  error?: string;
  alreadySynced?: boolean;
}

/**
 * Push a Mazaj order to Wedjat RSM. Uses external_ref for idempotency:
 * if the same Mazaj order ID is pushed twice, the second call is a no-op.
 */
export async function pushOrderToWedjat(opts: {
  mazajOrderId: string; // used as external_ref for idempotency
  tableName: string;
  items: { name: string; price: number; qty: number }[];
  total: number;
  customerName?: string | null;
}): Promise<PushOrderResult> {
  const client = getClient();
  const externalRef = `mazaj:${opts.mazajOrderId}`;

  try {
    // Idempotency check: if an order with this external_ref already exists, skip
    const existing = await client.execute({
      sql: "SELECT id FROM orders WHERE external_ref = ? LIMIT 1",
      args: [externalRef],
    });
    if (existing.rows.length > 0) {
      return {
        ok: true,
        wedjatOrderId: existing.rows[0].id as number,
        alreadySynced: true,
      };
    }

    // Find the table by name
    const tableResult = await client.execute({
      sql: "SELECT id FROM tables WHERE name = ? LIMIT 1",
      args: [opts.tableName],
    });
    if (tableResult.rows.length === 0) {
      return { ok: false, error: `Table "${opts.tableName}" not found in Wedjat RSM` };
    }
    const tableId = tableResult.rows[0].id as number;

    // Create the order with external_ref for idempotency
    const orderResult = await client.execute({
      sql: `INSERT INTO orders (table_id, status, order_type, subtotal_amount, total_amount, client_name, external_ref, created_at)
            VALUES (?, 'open', 'dinein', ?, ?, ?, ?, datetime('now'))`,
      args: [tableId, opts.total, opts.total, opts.customerName || null, externalRef],
    });
    const wedjatOrderId = Number(orderResult.lastInsertRowid);

    // Insert order items — match product by name, update unit_price
    for (const item of opts.items) {
      const prodResult = await client.execute({
        sql: "SELECT id FROM products WHERE name = ? AND active = 1 LIMIT 1",
        args: [item.name],
      });
      const productId =
        prodResult.rows.length > 0
          ? (prodResult.rows[0].id as number)
          : null;

      await client.execute({
        sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price, status, created_at)
              VALUES (?, ?, ?, ?, 'sent', datetime('now'))`,
        args: [wedjatOrderId, productId, item.qty, item.price],
      });
    }

    // Mark the table as occupied
    await client.execute({
      sql: "UPDATE tables SET status = 'occupied' WHERE id = ?",
      args: [tableId],
    });

    return { ok: true, wedjatOrderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not push to Wedjat",
    };
  }
}

// --- PRICE SYNC: update Wedjat product prices when Mazaj prices change ---

/**
 * Update a product's price in Wedjat RSM (matched by product name).
 * Used when shisha prices change on the Mazaj side.
 */
export async function syncProductPriceToWedjat(
  productName: string,
  newPrice: number
): Promise<{ ok: boolean; updated: number; error?: string }> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "UPDATE products SET price = ? WHERE name = ? AND active = 1",
      args: [newPrice, productName],
    });
    return { ok: true, updated: result.rowsAffected };
  } catch (err) {
    return {
      ok: false,
      updated: 0,
      error: err instanceof Error ? err.message : "Price sync failed",
    };
  }
}

/**
 * Fetch the current price of a product from Wedjat (to detect if Wedjat
 * changed it).
 */
export async function fetchWedjatProductPrice(
  productName: string
): Promise<{ price: number | null; error?: string }> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT price FROM products WHERE name = ? AND active = 1 LIMIT 1",
      args: [productName],
    });
    if (result.rows.length === 0) return { price: null };
    return { price: result.rows[0].price as number };
  } catch (err) {
    return {
      price: null,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

// --- REVOCATION SYNC: detect cancelled orders in Wedjat ---

export interface WedjatRevocation {
  wedjatOrderId: number;
  mazajOrderId: string;
  revokedBy: string; // Wedjat user_name
  revokedAt: string;
}

/**
 * Check Wedjat for orders that were pushed from Mazaj (external_ref LIKE 'mazaj:%')
 * and have been cancelled/revoked. Returns the ones that are newly revoked.
 */
export async function fetchWedjatRevocations(
  since: Date
): Promise<WedjatRevocation[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `SELECT o.id as wedjat_order_id, o.external_ref, o.status,
                   o.updated_at, o.closed_at,
                   (SELECT al.user_name FROM audit_logs al
                    WHERE al.entity = 'order' AND al.entity_id = o.id
                      AND al.action LIKE '%cancel%'
                    ORDER BY al.id DESC LIMIT 1) as revoked_by
            FROM orders o
            WHERE o.external_ref LIKE 'mazaj:%'
              AND o.status = 'cancelled'
              AND (o.updated_at > ? OR o.closed_at > ?)`,
      args: [since.toISOString(), since.toISOString()],
    });
    return result.rows.map((row) => ({
      wedjatOrderId: row.wedjat_order_id as number,
      mazajOrderId: ((row.external_ref as string) || "").replace("mazaj:", ""),
      revokedBy: (row.revoked_by as string) || "Unknown",
      revokedAt: (row.updated_at as string) || (row.closed_at as string) || new Date().toISOString(),
    }));
  } catch (err) {
    console.error("[wedjat] fetchRevocations error:", err);
    return [];
  }
}

// --- HEALTH CHECK ---

/** Quick connectivity check for the sync status dashboard. */
export async function checkWedjatHealth(): Promise<{
  connected: boolean;
  tableCount: number;
  productCount: number;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    const client = getClient();
    const tables = await client.execute("SELECT COUNT(*) as c FROM tables");
    const products = await client.execute("SELECT COUNT(*) as c FROM products WHERE active = 1");
    return {
      connected: true,
      tableCount: tables.rows[0].c as number,
      productCount: products.rows[0].c as number,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { connected: false, tableCount: 0, productCount: 0, latencyMs: 0 };
  }
}
