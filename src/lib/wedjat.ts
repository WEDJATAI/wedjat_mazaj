// Wedjat RSM integration — queries the Wedjat restaurant database (Turso/libsql)
// directly to fetch tables and menu products for cross-system ordering.
//
// Credentials are read from env vars (see .env) — never hardcoded.

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
  status: string; // free | occupied | reserved | ...
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

/** Fetch all restaurant tables from Wedjat RSM. */
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

/** Fetch all menu categories from Wedjat RSM. */
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

/** Fetch all sellable, active, in-stock products from Wedjat RSM. */
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

/** Fetch products in a specific category (by category name). */
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

/**
 * Insert an order into the Wedjat RSM database so it appears in their POS.
 * Creates an open order on the given table with order items.
 */
export async function pushOrderToWedjat(opts: {
  tableName: string;
  items: { name: string; price: number; qty: number }[];
  total: number;
  customerName?: string | null;
  source?: string;
}): Promise<{ ok: boolean; wedjatOrderId?: number; error?: string }> {
  const client = getClient();
  try {
    // Find the table by name
    const tableResult = await client.execute({
      sql: "SELECT id FROM tables WHERE name = ? LIMIT 1",
      args: [opts.tableName],
    });
    if (tableResult.rows.length === 0) {
      return { ok: false, error: `Table "${opts.tableName}" not found in Wedjat RSM` };
    }
    const tableId = tableResult.rows[0].id as number;

    // Create the order
    const orderResult = await client.execute({
      sql: `INSERT INTO orders (table_id, status, order_type, subtotal_amount, total_amount, client_name, created_at)
            VALUES (?, 'open', 'dinein', ?, ?, ?, datetime('now'))`,
      args: [tableId, opts.total, opts.total, opts.customerName || null],
    });
    const wedjatOrderId = Number(orderResult.lastInsertRowid);

    // Insert order items
    for (const item of opts.items) {
      // Find the product by name (best-effort match)
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
