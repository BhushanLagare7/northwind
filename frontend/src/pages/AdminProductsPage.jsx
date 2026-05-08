/**
 * @fileoverview Admin page for managing the product catalog.
 * Renders a table of all products with edit and delete actions,
 * and a modal dialog for creating or updating a product.
 */

import { Navigate } from "react-router";
import { PackageIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { AdminProductForm } from "../components/AdminProductForm.jsx";
import { AdminProductsTableSkeleton } from "../components/LoadingSkeletons.jsx";
import { useAdminProductsPage } from "../hooks/useAdminProductsPage.js";
import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl.js";
import { formatPrice } from "../utils/format.js";

/**
 * Full-page admin view for the product catalog.
 *
 * Access control:
 * - Redirects non-admin users to "/" as soon as `meData` is available.
 *
 * Features:
 * - Tabular listing of all products with thumbnail, metadata, and status.
 * - "Add product" button opens the modal in create mode.
 * - Per-row Edit / Delete actions.
 * - A single shared modal that renders {@link AdminProductForm} in either
 *   create or edit mode depending on the `editing` state.
 *
 * All server interactions (save, delete) are handled by mutations provided
 * by {@link useAdminProductsPage}.
 *
 * @returns {JSX.Element} The admin products page, or a redirect for non-admins.
 */
function AdminProductsPage() {
  const {
    getToken, // Async function that resolves an ImageKit auth token.
    meData, // Current user data; used for role-based access control.
    modalOpen, // Whether the create/edit modal is visible.
    setModalOpen, // Setter for modalOpen.
    editing, // Product object being edited, or null in create mode.
    setEditing, // Setter for editing.
    products, // Array of all product records.
    isLoading, // True while the product list is being fetched.
    saveMutation, // React Query mutation for creating or updating a product.
    deleteMutation, // React Query mutation for deleting a product.
  } = useAdminProductsPage();

  // Redirect non-admin users as soon as their role is known.
  if (meData && meData.user?.role !== "admin") {
    return <Navigate replace to="/" />;
  }

  /**
   * Prompts the user for confirmation, then fires the delete mutation.
   * No-ops if the user cancels the confirm dialog.
   *
   * @param {{ id: string, name: string }} product - The product to delete.
   */
  function handleDeleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}" permanently?`)) return;

    deleteMutation.mutate(product.id);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="text-left">
      {/* Page header: title and "Add product" CTA */}
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <div className="flex gap-2 items-center">
          <PackageIcon aria-hidden className="size-8 text-secondary" />
          <div>
            <h1 className="text-2xl font-bold text-base-content">Products</h1>
            <p className="text-sm text-base-content/60">
              Manage catalog (admin only).
            </p>
          </div>
        </div>

        {/* Opens the modal in create mode (no editing target) */}
        <button
          className="gap-2 btn btn-primary btn-sm"
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <PlusIcon aria-hidden className="size-4" />
          Add product
        </button>
      </div>

      {/* Product table — replaced by a skeleton while data loads */}
      {isLoading ? (
        <AdminProductsTableSkeleton />
      ) : (
        <div className="overflow-x-auto border rounded-box border-base-300 bg-base-100">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th className="w-24">Preview</th>
                <th>Name</th>
                <th>Category</th>
                <th>Slug</th>
                <th>Price</th>
                <th>Active</th>
                <th /> {/* Actions column — no heading */}
              </tr>
            </thead>

            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  {/* Thumbnail: shows an optimized ImageKit image or a placeholder icon */}
                  <td className="align-middle">
                    <div className="overflow-hidden relative w-14 h-14 rounded-xl border ring-1 shadow-sm shrink-0 border-base-300 bg-base-200 ring-base-300/50 sm:h-18 sm:w-18">
                      {p.imageUrl ? (
                        <img
                          alt=""
                          className="object-cover w-full h-full"
                          decoding="async"
                          loading="lazy"
                          src={imageKitOptimizedUrl(
                            p.imageUrl,
                            IK_PRESETS.adminThumb,
                          )}
                        />
                      ) : (
                        /* Fallback gradient placeholder when no image is set */
                        <div className="flex justify-center items-center w-full h-full bg-linear-to-br from-base-300 to-base-200">
                          <PackageIcon
                            aria-hidden
                            className="size-6 text-base-content/35"
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="font-medium">{p.name}</td>

                  {/* Category badge; falls back to a dash if unset */}
                  <td>
                    <span className="badge badge-ghost badge-sm">
                      {p.category ?? "-"}
                    </span>
                  </td>

                  <td className="font-mono text-sm opacity-80">{p.slug}</td>

                  {/* Price formatted from cents using the product's currency */}
                  <td>{formatPrice(p.priceCents, p.currency)}</td>

                  {/* Active status badge */}
                  <td>
                    {p.active ? (
                      <span className="badge badge-success badge-sm">yes</span>
                    ) : (
                      <span className="badge badge-ghost badge-sm">no</span>
                    )}
                  </td>

                  {/* Row actions: Edit and Delete */}
                  <td>
                    <div className="flex flex-wrap gap-1 justify-end items-center">
                      {/* Opens the modal pre-populated with this product's data */}
                      <button
                        className="gap-1 btn btn-ghost btn-xs"
                        type="button"
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                      >
                        <PencilIcon aria-hidden className="size-3" />
                        Edit
                      </button>

                      {/*
                       * Delete button: disabled and shows a spinner while this
                       * specific product's delete request is in-flight.
                       * Keyed by comparing deleteMutation.variables to p.id
                       * so only the targeted row is affected.
                       */}
                      <button
                        className="gap-1 btn btn-ghost btn-xs text-error hover:bg-error/10"
                        disabled={
                          deleteMutation.isPending &&
                          deleteMutation.variables === p.id
                        }
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                      >
                        {deleteMutation.isPending &&
                        deleteMutation.variables === p.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2Icon aria-hidden className="size-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
       * Create / Edit modal.
       * `modal-open` drives visibility via a CSS class rather than the
       * native <dialog> API so DaisyUI transitions apply correctly.
       * The `key` prop on AdminProductForm resets all field state when
       * switching between products or switching to create mode.
       */}
      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="max-w-lg modal-box">
          <h3 className="text-lg font-bold">
            {editing ? "Edit product" : "New product"}
          </h3>

          <AdminProductForm
            key={editing?.id ?? "new"}
            error={saveMutation.isError}
            getToken={getToken}
            initial={editing}
            saving={saveMutation.isPending}
            onCancel={() => {
              setModalOpen(false);
              setEditing(null);
            }}
            /* Pass the editing id so the mutation can choose PUT vs POST */
            onSubmit={(body) => saveMutation.mutate({ body, id: editing?.id })}
          />
        </div>

        {/* Clicking the backdrop closes the modal without saving */}
        <button
          className="modal-backdrop bg-neutral/50"
          type="button"
          onClick={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      </dialog>
    </div>
  );
}

export default AdminProductsPage;
