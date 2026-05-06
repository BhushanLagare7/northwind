/**
 * @file orderController.ts
 * @description Controller functions for handling order-related HTTP requests.
 * This module provides Express route handlers for managing orders
 * and real-time communication features (chat and video)
 * in an e-commerce application. It integrates with Clerk for
 * authentication, Drizzle ORM for database operations, and Stream Chat
 * for real-time messaging.
 */

import { getAuth } from "@clerk/express";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

import { db } from "../db";
import { orderItems, orders, products, users } from "../db/schema";
import { getEnv } from "../lib/env";
import { isStaff } from "../lib/roles";
import {
  getStreamChatServer,
  streamChatDisplayName,
  streamUserId,
} from "../lib/stream";
import { getLocalUser } from "../lib/users";

// Load environment variables once at module initialization
const env = getEnv();

/**
 * GET /orders
 *
 * Retrieves a list of orders with lightweight preview data for each order.
 *
 * @access Authenticated users only
 *
 * @behavior
 * - **Staff/Admin**: Returns ALL orders in the system, sorted by newest first.
 * - **Regular users**: Returns only their own orders, sorted by newest first.
 *
 * Each order in the response is enriched with `previewItems`, which is a
 * condensed list of the products in that order (name, slug, imageUrl, quantity).
 * This avoids a full item fetch and is suitable for order list/summary views.
 *
 * @param {Request}      req  - Express request object (no query params required)
 * @param {Response}     res  - Express response object
 * @param {NextFunction} next - Express next middleware (used for error forwarding)
 *
 * @returns {200} JSON payload:
 * ```json
 * {
 *   "orders": [
 *     {
 *       "id": "uuid",
 *       "userId": "uuid",
 *       "status": "paid",
 *       "createdAt": "2024-01-01T00:00:00.000Z",
 *       "previewItems": [
 *         {
 *           "name": "Product Name",
 *           "slug": "product-slug",
 *           "imageUrl": "https://...",
 *           "quantity": 2
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 *
 * @returns {401} `{ error: "Unauthorized" }`
 *   — User is not authenticated via Clerk.
 *
 * @returns {503} `{ error: "Account not synced yet" }`
 *   — Clerk user exists but has not yet been synced to the local database
 *     (e.g., webhook delay on first sign-up).
 */
export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── 2. Local user resolution ────────────────────────────────────────────
    // Clerk manages authentication, but business data (role, id) lives in our
    // own `users` table. A missing local user means the sync webhook hasn't
    // fired yet — return 503 so the client can retry.
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    // ── 3. Fetch orders (role-scoped) ────────────────────────────────────────
    // Staff see every order; regular users see only their own.
    const rows = isStaff(localUser.role)
      ? await db.select().from(orders).orderBy(desc(orders.createdAt))
      : await db
          .select()
          .from(orders)
          .where(eq(orders.userId, localUser.id))
          .orderBy(desc(orders.createdAt));

    // ── 4. Batch-fetch preview items ─────────────────────────────────────────
    // Using a single JOIN query with `inArray` is far more efficient than
    // issuing one query per order (N+1 problem avoidance).
    const orderIds = rows.map((r) => r.id);
    // Map<orderId, PreviewItem[]> — built below for O(1) lookup per order
    const previewByOrder = new Map();

    if (orderIds.length > 0) {
      const itemRows = await db
        .select({
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          name: products.name,
          slug: products.slug,
          imageUrl: products.imageUrl,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds))
        // Stable ordering so previews appear consistently
        .orderBy(asc(orderItems.id));

      // Group items by their parent orderId
      for (const row of itemRows) {
        const list = previewByOrder.get(row.orderId) ?? [];
        list.push({
          name: row.name,
          slug: row.slug,
          imageUrl: row.imageUrl,
          quantity: row.quantity,
        });
        previewByOrder.set(row.orderId, list);
      }
    }

    // ── 5. Assemble and respond ──────────────────────────────────────────────
    // Spread each order row and attach its preview items (default: empty array
    // for orders that somehow have no items yet).
    const ordersPayload = rows.map((o) => ({
      ...o,
      previewItems: previewByOrder.get(o.id) ?? [],
    }));

    res.json({ orders: ordersPayload });
  } catch (e) {
    // Delegate unexpected errors to the global Express error handler
    next(e);
  }
}

/**
 * GET /orders/:id
 *
 * Retrieves the full details of a single order, including all line items
 * with their associated product data and unit prices.
 *
 * @access
 * - The **order owner** (customer who placed it).
 * - Any user with a **staff or admin role**.
 * - All other authenticated users receive a 404 (intentional — avoids leaking
 *   the existence of orders that don't belong to the caller).
 *
 * @param {Request}      req          - Express request; expects `req.params.id` (order UUID)
 * @param {Response}     res          - Express response object
 * @param {NextFunction} next         - Express next middleware
 *
 * @returns {200} JSON payload:
 * ```json
 * {
 *   "order": {
 *     "id": "uuid",
 *     "userId": "uuid",
 *     "status": "paid",
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "items": [
 *     {
 *       "id": "uuid",
 *       "quantity": 1,
 *       "unitPriceCents": 4999,
 *       "product": { ...full product row }
 *     }
 *   ]
 * }
 * ```
 *
 * @returns {401} `{ error: "Unauthorized" }`
 *   — User is not authenticated.
 *
 * @returns {404} `{ error: "Not found" }`
 *   — Order does not exist, OR the caller lacks permission to view it.
 *     (Using 404 rather than 403 to avoid revealing that the order exists.)
 *
 * @returns {503} `{ error: "Account not synced yet" }`
 *   — Local user record is not yet available.
 */
export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── 2. Local user resolution ────────────────────────────────────────────
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    // ── 3. Fetch the order ───────────────────────────────────────────────────
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // ── 4. Authorization check ───────────────────────────────────────────────
    // Only the order's owner or a staff member may view its details.
    // Return 404 (not 403) so that unauthorized callers cannot infer
    // whether a given order ID exists in the system.
    const canAccess = order.userId === localUser.id || isStaff(localUser.role);
    if (!canAccess) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // ── 5. Fetch full line items with product details ─────────────────────────
    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        unitPriceCents: orderItems.unitPriceCents, // Price snapshot at purchase time
        product: products, // Full product record via JOIN
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    res.json({ order, items });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /orders/:id/stream-channel
 *
 * Creates (or re-opens) a **Stream Chat** messaging channel scoped to a
 * specific order, enabling the customer to communicate with support staff.
 *
 * @access
 * - The **order owner** (customer).
 * - Users with a **staff or admin role**.
 *
 * @precondition The order must have a status of `"paid"`. Unpaid orders are
 * not eligible for support chat to prevent pre-payment abuse.
 *
 * @behavior
 * 1. Upserts the caller as a Stream Chat user (creates if not exists, updates
 *    display name if it changed).
 * 2. Creates a `"messaging"` channel with ID `order-{orderId}`. If the channel
 *    already exists, Stream Chat returns the existing one — making this call
 *    idempotent.
 * 3. Adds the caller as a member of the channel.
 * 4. Returns the channel identifiers needed by the frontend Stream Chat SDK.
 *
 * @param {Request}      req  - Express request; expects `req.params.id` (order UUID)
 * @param {Response}     res  - Express response object
 * @param {NextFunction} next - Express next middleware
 *
 * @returns {200} JSON payload:
 * ```json
 * {
 *   "channelType": "messaging",
 *   "channelId": "order-<uuid>",
 *   "streamUserId": "stream-user-<clerkUserId>"
 * }
 * ```
 *
 * @returns {401} `{ error: "Unauthorized" }`
 *   — User is not authenticated.
 *
 * @returns {403} `{ error: "Order must be paid to open support chat" }`
 *   — Order exists but has not been paid.
 *
 * @returns {404} `{ error: "Not found" }`
 *   — Order does not exist, or caller is neither the owner nor staff.
 *
 * @returns {503} `{ error: "Account not synced yet" }`
 *   — Local user record is not yet available.
 */
export async function createStreamChannel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── 2. Stream Chat server-side client ────────────────────────────────────
    // Must be instantiated with server-side credentials (API secret).
    // Never expose the Stream secret to the client.
    const server = getStreamChatServer(env);

    // ── 3. Local user resolution ────────────────────────────────────────────
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    // ── 4. Fetch and validate the order ─────────────────────────────────────
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // ── 5. Authorization check ───────────────────────────────────────────────
    const isOwner = order.userId === localUser.id;
    if (!isOwner && !isStaff(localUser.role)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // ── 6. Business rule: only paid orders qualify for support chat ──────────
    if (order.status !== "paid") {
      res
        .status(403)
        .json({ error: "Order must be paid to open support chat" });
      return;
    }

    // ── 7. Upsert caller in Stream Chat ──────────────────────────────────────
    // `streamUserId` converts a Clerk user ID to a Stream-safe user ID format.
    // `streamChatDisplayName` returns a role-appropriate display name
    // (e.g., "Support Agent" for staff, or the customer's actual name).
    const streamChatUserId = streamUserId(userId);

    await server.upsertUser({
      id: streamChatUserId,
      name: streamChatDisplayName(
        localUser.role,
        localUser.displayName,
        localUser.email,
      ),
    });

    // ── 8. Create (or retrieve) the channel ──────────────────────────────────
    // Channel IDs are deterministic (`order-{uuid}`) so this operation is
    // idempotent — calling it multiple times is safe and won't create duplicates.
    const channelId = `order-${order.id}`;
    const channel = server.channel("messaging", channelId, {
      name: `Support · order ${order.id.slice(0, 8)}`, // Truncated for readability
      created_by_id: streamChatUserId,
    });

    await channel.create();

    // ── 9. Add caller as a channel member ────────────────────────────────────
    // Members can send and receive messages. Staff join the channel separately
    // (e.g., when they open the conversation on the dashboard).
    await channel.addMembers([streamChatUserId]);

    res.json({
      channelType: "messaging",
      channelId,
      streamUserId: streamChatUserId,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /orders/:id/video-invite
 *
 * Allows a **staff or admin** user to send a video call invitation inside the
 * order's Stream Chat channel. The invitation appears as a message containing
 * a join URL, and carries a `video_invite: true` custom flag so the frontend
 * can render a rich "Join Call" button instead of a plain text link.
 *
 * @access Staff and admin roles **only**.
 *
 * @precondition
 * - Order must exist and have a status of `"paid"`.
 * - Both the customer and the staff member are upserted into Stream Chat
 *   before the message is sent, ensuring membership is valid.
 *
 * @behavior
 * 1. Validates that the caller is a staff/admin member.
 * 2. Fetches the order and its owner (the customer).
 * 3. Upserts both the customer and the staff member in Stream Chat.
 * 4. Creates (or retrieves) the order's messaging channel and ensures both
 *    parties are members.
 * 5. Sends a structured message with the video call join URL.
 * 6. Returns `{ ok: true, joinUrl }` to the caller.
 *
 * @param {Request}      req  - Express request; expects `req.params.id` (order UUID)
 * @param {Response}     res  - Express response object
 * @param {NextFunction} next - Express next middleware
 *
 * @returns {200} JSON payload:
 * ```json
 * {
 *   "ok": true,
 *   "joinUrl": "https://app.example.com/orders/<uuid>/call"
 * }
 * ```
 *
 * @returns {401} `{ error: "Unauthorized" }`
 *   — User is not authenticated.
 *
 * @returns {403} `{ error: "Only support or admin can send a video invite" }`
 *   — Caller is a regular customer, not staff.
 *
 * @returns {404} `{ error: "Order not found or not paid" }`
 *   — Order does not exist or has not been paid.
 *
 * @returns {503} `{ error: "Account not synced yet" }`
 *   — Local user record is not yet available.
 */
export async function createVideoInvite(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const { userId, isAuthenticated } = getAuth(req);
    if (!isAuthenticated || !userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // ── 2. Stream Chat server-side client ────────────────────────────────────
    const server = getStreamChatServer(env);

    // ── 3. Local user resolution ────────────────────────────────────────────
    const localUser = await getLocalUser(userId);
    if (!localUser) {
      res.status(503).json({ error: "Account not synced yet" });
      return;
    }

    // ── 4. Role guard ────────────────────────────────────────────────────────
    // Video invites are a staff-only action. Regular customers cannot initiate
    // them, preventing misuse of the video call infrastructure.
    if (!isStaff(localUser.role)) {
      res
        .status(403)
        .json({ error: "Only support or admin can send a video invite" });
      return;
    }

    // ── 5. Fetch and validate the order ─────────────────────────────────────
    // Combined guard: the order must exist AND be in a paid state.
    // Unpaid orders don't have an active support relationship yet.
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id as string))
      .limit(1);

    if (!order || order.status !== "paid") {
      res.status(404).json({ error: "Order not found or not paid" });
      return;
    }

    // ── 6. Fetch the order owner (customer) ──────────────────────────────────
    // We need the customer's Stream identity so they can be added to the channel
    // and receive the video invite message — even if they haven't opened chat yet.
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);

    // ── 7. Upsert the customer in Stream Chat ────────────────────────────────
    const customerSid = streamUserId(owner.clerkUserId);
    await server.upsertUser({
      id: customerSid,
      name: owner.displayName ?? owner.email ?? "Customer",
    });

    // ── 8. Upsert the staff member in Stream Chat ────────────────────────────
    const staffStreamUserId = streamUserId(userId);
    await server.upsertUser({
      id: staffStreamUserId,
      name: streamChatDisplayName(
        localUser.role,
        localUser.displayName,
        localUser.email,
      ),
    });

    // ── 9. Create (or retrieve) the channel and add both members ─────────────
    // The channel is created from the customer's perspective (created_by_id)
    // to maintain channel ownership semantics, even though staff initiated it.
    const channelId = `order-${order.id}`;
    const channel = server.channel("messaging", channelId, {
      name: `Support · order ${order.id.slice(0, 8)}`,
      created_by_id: customerSid,
    });

    await channel.create();
    // Add both parties as members so each can see the channel in their inbox
    await channel.addMembers([customerSid, staffStreamUserId]);

    // ── 10. Build the join URL ───────────────────────────────────────────────
    // Trailing slashes are stripped from the base URL to prevent double-slash
    // URLs (e.g., "https://app.example.com//orders/...").
    const joinUrl = `${env.FRONTEND_URL.replace(/\/+$/, "")}/orders/${order.id}/call`;

    // ── 11. Send the video invite message ────────────────────────────────────
    // The `custom` payload allows the frontend to detect `video_invite: true`
    // and render a rich component (button, call preview, etc.) instead of
    // displaying the raw URL as plain text.
    await channel.sendMessage({
      text: `Video call — tap Join below (same link for everyone): ${joinUrl}`,
      user_id: staffStreamUserId,
      custom: {
        video_invite: true, // Frontend feature flag for rich rendering
        join_url: joinUrl, // Structured URL for frontend to extract safely
      },
    });

    res.json({ ok: true, joinUrl });
  } catch (e) {
    next(e);
  }
}
