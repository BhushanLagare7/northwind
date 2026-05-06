/**
 * @fileoverview Express router for admin-only API endpoints.
 * All routes are protected by the {@link requireAdmin} middleware.
 *
 * Base path (mounted in the main app): `/api/admin`
 *
 * | Method   | Path                      | Description                        |
 * |----------|---------------------------|------------------------------------|
 * | `GET`    | `/imagekit/auth`          | Get signed ImageKit upload params  |
 * | `GET`    | `/products`               | List all products                  |
 * | `POST`   | `/products`               | Create a new product               |
 * | `PATCH`  | `/products/:id`           | Partially update a product         |
 * | `DELETE` | `/products/:id`           | Delete a product                   |
 */

import { Router } from "express";

import {
  createAdminProduct,
  deleteAdminProduct,
  getImageKitAuth,
  listAdminProducts,
  requireAdmin,
  updateAdminProduct,
} from "../controllers/adminController";

const router = Router();

/** Enforce authentication and admin role on every route in this router. */
router.use(requireAdmin);

// ImageKit
router.get("/imagekit/auth", getImageKitAuth);

// Product CRUD
router.get("/products", listAdminProducts);
router.post("/products", createAdminProduct);
router.patch("/products/:id", updateAdminProduct);
router.delete("/products/:id", deleteAdminProduct);

export default router;
