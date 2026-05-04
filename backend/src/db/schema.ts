/**
 * @fileoverview Database schema definitions using Drizzle ORM for a PostgreSQL database.
 *
 * **DEFINITIONS:**
 * 1. User management with role-based access control
 * 2. Product catalog management
 * 3. Checkout session tracking (integrated with Polar payment provider)
 * 4. Order lifecycle management
 * 5. Order line item details
 *
 * ## Entity Relationship Overview
 * ```
 * users (1) ──────────── (many) orders
 * orders (1) ─────────── (many) orderItems
 * products (1) ────────── (many) orderItems
 * users (1) ──────────── (many) checkoutSessions
 * ```
 *
 * ## Referential Integrity Strategy
 * - `CASCADE`  → child rows are automatically deleted when the parent is deleted.
 * - `RESTRICT` → parent deletion is blocked while any child row still references it.
 *
 * @module schema
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// SHARED / UTILITY TYPES
// ─────────────────────────────────────────────

/**
 * Represents the lifecycle state of an order.
 *
 * | Value     | Meaning                                              |
 * |-----------|------------------------------------------------------|
 * | `pending` | Order has been created but payment is not confirmed. |
 * | `paid`    | Payment was successfully captured.                   |
 * | `failed`  | Payment attempt failed or was rejected.              |
 */
export type OrderStatus = "pending" | "paid" | "failed";

/**
 * Defines the access-control role assigned to a user account.
 *
 * | Value      | Meaning                                          |
 * |------------|--------------------------------------------------|
 * | `customer` | Regular buyer with no elevated privileges.       |
 * | `support`  | Internal staff who can view/manage orders.       |
 * | `admin`    | Full platform access including product management|
 */
export type UserRole = "customer" | "support" | "admin";

/**
 * Represents a single line inside a checkout session's `lines` JSONB column.
 *
 * Each entry captures a snapshot of the product being purchased and the price
 * agreed upon at checkout time, so historical pricing remains accurate even if
 * the product's price is later changed.
 *
 * @property productId      - UUID of the product being purchased.
 * @property quantity       - Number of units the customer intends to buy.
 * @property unitPriceCents - Price per unit in the smallest currency unit (e.g. cents for USD).
 */
export type CheckoutSessionLine = {
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

// ─────────────────────────────────────────────
// TABLE DEFINITIONS
// ─────────────────────────────────────────────

/**
 * **`users` table** — Stores platform user accounts.
 *
 * Authentication is delegated to Clerk; this table holds only the data the
 * application needs to function (roles, display name, etc.). The `clerkUserId`
 * column is the bridge between Clerk's identity layer and this database.
 *
 * ### Columns
 * | Column        | Type        | Notes                                          |
 * |---------------|-------------|------------------------------------------------|
 * | id            | uuid (PK)   | Auto-generated primary key.                    |
 * | clerkUserId   | text        | Unique identifier issued by Clerk. Not null.   |
 * | email         | text        | User's email address. Defaults to empty string.|
 * | displayName   | text        | Optional human-readable name shown in the UI.  |
 * | role          | UserRole    | Access-control role. Defaults to `customer`.   |
 * | createdAt     | timestamptz | Row creation time (UTC).                       |
 * | updatedAt     | timestamptz | Last modification time (UTC).                  |
 *
 * ### Relations
 * - Has **many** {@link orders}
 * - Has **many** {@link checkoutSessions}
 */
export const users = pgTable("users", {
  /** Auto-generated UUID primary key. */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * The external user identifier issued by Clerk.
   * Used to link an authenticated Clerk session back to a platform user row.
   * Must be unique across all users.
   */
  clerkUserId: text("clerk_user_id").notNull().unique(),

  /** The user's email address. Stored for display / notification purposes. */
  email: text("email").notNull().default(""),

  /** Optional display name shown in the UI (e.g. "Jane Doe"). */
  displayName: text("display_name"),

  /**
   * Role that governs what the user is permitted to do on the platform.
   * Typed as {@link UserRole}; defaults to `"customer"` for new sign-ups.
   */
  role: text("role").$type<UserRole>().notNull().default("customer"),

  /** Timestamp (with time zone) when this record was first created. */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /** Timestamp (with time zone) when this record was last updated. */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * **`products` table** — Represents items available for purchase in the catalog.
 *
 * Products are identified externally by a human-readable `slug` (useful for
 * SEO-friendly URLs) and internally by a UUID. Images are hosted on ImageKit;
 * the `imageKitFileId` is stored so images can be deleted from ImageKit when a
 * product is removed or its image is replaced.
 *
 * ### Columns
 * | Column          | Type      | Notes                                             |
 * |-----------------|-----------|---------------------------------------------------|
 * | id              | uuid (PK) | Auto-generated primary key.                       |
 * | slug            | text      | URL-friendly unique identifier (e.g. `"blue-mug"`)|
 * | name            | text      | Human-readable product name.                      |
 * | category        | text      | Grouping label; defaults to `"General"`.          |
 * | description     | text      | Long-form product description.                    |
 * | priceCents      | integer   | Listed price in smallest currency unit.           |
 * | currency        | text      | ISO 4217 currency code; defaults to `"usd"`.      |
 * | imageUrl        | text      | Public URL of the product image (nullable).       |
 * | imageKitFileId  | text      | ImageKit `fileId` used for programmatic deletes.  |
 * | active          | boolean   | Whether the product is visible/purchasable.       |
 * | createdAt       | timestamptz | Row creation time (UTC).                        |
 *
 * ### Relations
 * - Has **many** {@link orderItems}
 */
export const products = pgTable("products", {
  /** Auto-generated UUID primary key. */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * URL-safe unique slug used in product URLs (e.g. `/products/blue-mug`).
   * Must be unique across all products.
   */
  slug: text("slug").notNull().unique(),

  /** Display name of the product shown in listings and on the product page. */
  name: text("name").notNull(),

  /**
   * Category label used to group products (e.g. `"Apparel"`, `"Electronics"`).
   * Defaults to `"General"` when no category is specified.
   */
  category: text("category").notNull().default("General"),

  /** Detailed product description rendered on the product detail page. */
  description: text("description").notNull().default(""),

  /**
   * The product's listed price expressed in the **smallest unit** of `currency`
   * (e.g. cents for USD, pence for GBP). Using integers avoids floating-point
   * rounding issues common with monetary values.
   */
  priceCents: integer("price_cents").notNull(),

  /**
   * ISO 4217 currency code for the price (e.g. `"usd"`, `"eur"`).
   * Defaults to `"usd"`.
   */
  currency: text("currency").notNull().default("usd"),

  /**
   * Publicly accessible URL of the product's primary image.
   * Nullable — products may be created before an image is uploaded.
   */
  imageUrl: text("image_url"),

  /**
   * ImageKit `fileId` for the uploaded product image.
   * Stored so the image can be deleted from ImageKit when the product is
   * removed or its image is replaced, preventing orphaned files.
   */
  imageKitFileId: text("image_kit_file_id"),

  /**
   * Controls whether the product is active (visible and purchasable).
   * Setting `active = false` soft-hides the product without deleting it.
   * Defaults to `true`.
   */
  active: boolean("active").notNull().default(true),

  /** Timestamp (with time zone) when this record was first created. */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * **`checkout_sessions` table** — Captures the state of a Polar-powered checkout flow.
 *
 * A checkout session is created when a user initiates payment. It stores a
 * snapshot of the cart (`lines`) so the intended purchase can be reconciled
 * against the resulting {@link orders} row once the payment provider confirms
 * or rejects payment.
 *
 * ### Columns
 * | Column            | Type               | Notes                                           |
 * |-------------------|--------------------|-------------------------------------------------|
 * | id                | uuid (PK)          | Auto-generated primary key.                     |
 * | userId            | uuid (FK → users)  | Owner of the session. Cascades on user delete.  |
 * | polarCheckoutId   | text               | Unique session ID returned by the Polar API.    |
 * | lines             | jsonb              | Array of {@link CheckoutSessionLine} objects.   |
 * | totalCents        | integer            | Sum of all line totals in smallest currency unit|
 * | currency          | text               | ISO 4217 currency code for this session.        |
 * | createdAt         | timestamptz        | Row creation time (UTC).                        |
 *
 * ### Relations
 * - Belongs to **one** {@link users} (cascade delete)
 */
export const checkoutSessions = pgTable("checkout_sessions", {
  /** Auto-generated UUID primary key. */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Foreign key referencing the {@link users} table.
   * Identifies which user initiated this checkout session.
   * Cascades: when a user is deleted, their checkout sessions are also deleted.
   */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /**
   * The checkout session identifier returned by the Polar payment API.
   * Stored so incoming Polar webhooks can be matched to this row.
   * Nullable until Polar confirms the session was created successfully.
   */
  polarCheckoutId: text("polar_checkout_id").unique(),

  /**
   * JSONB snapshot of the cart at the time the session was created.
   * Typed as an array of {@link CheckoutSessionLine}.
   * Storing this here makes reconciliation possible even if product prices
   * change between session creation and order fulfillment.
   */
  lines: jsonb("lines").$type<CheckoutSessionLine[]>().notNull(),

  /**
   * Pre-calculated grand total in the smallest unit of `currency`.
   * Should equal the sum of (`quantity` × `unitPriceCents`) across all `lines`.
   */
  totalCents: integer("total_cents").notNull(),

  /** ISO 4217 currency code for the entire session (e.g. `"usd"`). */
  currency: text("currency").notNull(),

  /** Timestamp (with time zone) when this record was first created. */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * **`orders` table** — Represents a confirmed (or in-progress) customer order.
 *
 * An order is typically created after a checkout session succeeds (via a Polar
 * webhook). The `status` field tracks the payment lifecycle. Both Polar IDs are
 * stored to support webhook reconciliation and customer support look-ups.
 *
 * ### Columns
 * | Column           | Type               | Notes                                               |
 * |------------------|--------------------|-----------------------------------------------------|
 * | id               | uuid (PK)          | Auto-generated primary key.                         |
 * | userId           | uuid (FK → users)  | Owner of the order. Cascades on user delete.        |
 * | status           | OrderStatus        | Payment lifecycle state. Defaults to `"pending"`.   |
 * | polarCheckoutId  | text               | Links back to the originating checkout session.     |
 * | polarOrderId     | text               | Unique order ID assigned by Polar after payment.    |
 * | totalCents       | integer            | Grand total in smallest currency unit.              |
 * | createdAt        | timestamptz        | Row creation time (UTC).                            |
 * | updatedAt        | timestamptz        | Last modification time (UTC).                       |
 *
 * ### Relations
 * - Belongs to **one** {@link users} (cascade delete)
 * - Has **many** {@link orderItems}
 */
export const orders = pgTable("orders", {
  /** Auto-generated UUID primary key. */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Foreign key referencing the {@link users} table.
   * Identifies which user placed this order.
   * Cascades: when a user is deleted, all of their orders are also deleted.
   */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  /**
   * Current payment / fulfillment status of the order.
   * Typed as {@link OrderStatus}. Defaults to `"pending"` at creation and is
   * updated to `"paid"` or `"failed"` via Polar webhooks.
   */
  status: text("status").$type<OrderStatus>().notNull().default("pending"),

  /**
   * The Polar checkout session ID that originated this order.
   * Used to trace an order back to the initiating checkout session for
   * debugging or customer support purposes.
   */
  polarCheckoutId: text("polar_checkout_id"),

  /**
   * The unique order ID assigned by Polar once payment is confirmed.
   * Must be unique across all orders; null until Polar fires the order webhook.
   */
  polarOrderId: text("polar_order_id").unique(),

  /**
   * Grand total for this order in the smallest currency unit.
   * Defaults to `0`; should be updated to the actual total once confirmed.
   */
  totalCents: integer("total_cents").notNull().default(0),

  /** Timestamp (with time zone) when this record was first created. */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  /** Timestamp (with time zone) when this record was last updated. */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * **`order_items` table** — Stores individual line items that belong to an order.
 *
 * Each row represents a single product within an order, including the quantity
 * purchased and the unit price **at the time of purchase**. Capturing the price
 * here (rather than looking it up from `products`) preserves historical accuracy
 * when product prices change later.
 *
 * ### Columns
 * | Column         | Type                  | Notes                                              |
 * |----------------|-----------------------|----------------------------------------------------|
 * | id             | uuid (PK)             | Auto-generated primary key.                        |
 * | orderId        | uuid (FK → orders)    | Parent order. Cascades on order delete.            |
 * | productId      | uuid (FK → products)  | Referenced product. Restricted — cannot delete a   |
 * |                |                       | product while order items still reference it.      |
 * | quantity       | integer               | Number of units purchased.                         |
 * | unitPriceCents | integer               | Price per unit in smallest currency unit at time   |
 * |                |                       | of purchase (immutable snapshot).                  |
 *
 * ### Relations
 * - Belongs to **one** {@link orders} (cascade delete)
 * - Belongs to **one** {@link products} (restrict delete)
 */
export const orderItems = pgTable("order_items", {
  /** Auto-generated UUID primary key. */
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Foreign key referencing the parent {@link orders} row.
   * Cascades: when an order is deleted, all of its line items are also deleted.
   */
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  /**
   * Foreign key referencing the {@link products} table.
   * Uses RESTRICT so that a product cannot be deleted while at least one
   * order item still references it, preserving historical order integrity.
   */
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),

  /** Number of units of the product that were purchased in this line item. */
  quantity: integer("quantity").notNull(),

  /**
   * Price per unit **at the time of purchase**, expressed in the smallest
   * currency unit (e.g. cents). Snapshotted here so that future price changes
   * to the product do not alter historical order totals.
   */
  unitPriceCents: integer("unit_price_cents").notNull(),
});

// ─────────────────────────────────────────────
// DRIZZLE ORM RELATION DEFINITIONS
// ─────────────────────────────────────────────
//
// These declarations teach Drizzle how tables relate to one another so it can
// generate type-safe joined queries. They do NOT create foreign key constraints
// in the database — those are handled by the `.references()` calls above.
//
// Referential action reminder:
//   CASCADE  → automatically delete child rows when the parent is deleted.
//   RESTRICT → block deletion of a parent while any child row still points at it.

/**
 * Relation: **users → orders** (one-to-many)
 *
 * A single user account can be associated with any number of orders placed over
 * their lifetime on the platform.
 */
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

/**
 * Relation: **products → orderItems** (one-to-many)
 *
 * A single product can appear as a line item across many different orders.
 * Note: the product cannot be deleted while any order item still references it
 * (enforced via the RESTRICT foreign key on `orderItems.productId`).
 */
export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
}));

/**
 * Relation: **orders ↔ users / orderItems** (many-to-one + one-to-many)
 *
 * - Each order belongs to **exactly one** user (resolved via `orders.userId`).
 * - Each order can contain **many** order items (individual product lines).
 */
export const ordersRelations = relations(orders, ({ one, many }) => ({
  /** The user who placed this order. */
  user: one(users, { fields: [orders.userId], references: [users.id] }),

  /** The individual product line items that make up this order. */
  items: many(orderItems),
}));

/**
 * Relation: **orderItems ↔ orders / products** (many-to-one on both sides)
 *
 * - Each order item belongs to **exactly one** order.
 * - Each order item references **exactly one** product (the purchased item).
 */
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  /** The parent order that contains this line item. */
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),

  /** The product that was purchased in this line item. */
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
