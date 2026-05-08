/**
 * @fileoverview Custom React hook for managing the Admin Products page.
 *
 * Handles fetching, creating, updating, and deleting products
 * through authenticated API calls. Access is restricted to
 * signed-in users with the "admin" role.
 *
 * @module useAdminProductsPage
 */

import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

/**
 * Custom hook that encapsulates all state, queries, and mutations
 * required by the Admin Products page.
 *
 * @returns {Object} An object containing auth state, UI state,
 *                   product data, loading indicators, and mutation handlers.
 *
 * @property {Function} getToken       - Clerk helper to retrieve the current auth token.
 * @property {boolean}  isSignedIn     - Whether the current user is signed in.
 * @property {Object}   meData         - Current user profile data returned from /api/me.
 * @property {boolean}  modalOpen      - Whether the create/edit product modal is open.
 * @property {Function} setModalOpen   - Setter to open or close the modal.
 * @property {Object|null} editing     - The product currently being edited, or null if creating.
 * @property {Function} setEditing     - Setter to define which product is being edited.
 * @property {Array}    products       - List of products fetched from the admin products endpoint.
 * @property {boolean}  isLoading      - Whether the products query is in a loading state.
 * @property {Object}   saveMutation   - React Query mutation object for creating or updating a product.
 * @property {Object}   deleteMutation - React Query mutation object for deleting a product.
 *
 * @example
 * function AdminProductsPage() {
 *   const {
 *     products,
 *     isLoading,
 *     modalOpen,
 *     setModalOpen,
 *     editing,
 *     setEditing,
 *     saveMutation,
 *     deleteMutation,
 *   } = useAdminProductsPage();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       <ProductTable
 *         products={products}
 *         onEdit={(product) => { setEditing(product); setModalOpen(true); }}
 *         onDelete={(id) => deleteMutation.mutate(id)}
 *       />
 *       {modalOpen && (
 *         <ProductModal
 *           product={editing}
 *           onSave={(body) => saveMutation.mutate({ body, id: editing?.id })}
 *           onClose={() => setModalOpen(false)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 */
export function useAdminProductsPage() {
  /** Clerk auth helpers: token getter and sign-in status. */
  const { getToken, isSignedIn } = useAuth();

  /** React Query client used to invalidate cached queries after mutations. */
  const queryClient = useQueryClient();

  /**
   * Controls the visibility of the product create/edit modal.
   * @type {[boolean, Function]}
   */
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * Holds the product object currently selected for editing.
   * Null when the modal is in "create" mode.
   * @type {[Object|null, Function]}
   */
  const [editing, setEditing] = useState(null);

  /**
   * Fetches the current user's profile to determine their role.
   * Only runs when the user is signed in.
   *
   * @type {import("@tanstack/react-query").UseQueryResult}
   */
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me", { getToken }),
    enabled: isSignedIn,
  });

  /**
   * Derived boolean indicating whether the current user has the "admin" role.
   * Used to conditionally enable the admin products query.
   *
   * @type {boolean}
   */
  const isAdmin = meData?.user?.role === "admin";

  /**
   * Fetches the full list of products from the admin endpoint.
   * Only runs when the user is both signed in and confirmed as an admin.
   *
   * @type {import("@tanstack/react-query").UseQueryResult}
   */
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch("/api/admin/products", { getToken }),
    enabled: isSignedIn && isAdmin,
  });

  /**
   * Mutation for saving a product — handles both create and update operations.
   *
   * - If `id` is provided  → sends a PATCH request to update the existing product.
   * - If `id` is omitted   → sends a POST request to create a new product.
   *
   * On success, invalidates all related query caches and closes the modal.
   *
   * @type {import("@tanstack/react-query").UseMutationResult}
   *
   * @example
   * // Create a new product
   * saveMutation.mutate({ body: { name: "New Product", price: 9.99 } });
   *
   * // Update an existing product
   * saveMutation.mutate({ body: { name: "Updated Name" }, id: "product-123" });
   */
  const saveMutation = useMutation({
    /**
     * @param {Object} params      - Mutation parameters.
     * @param {Object} params.body - The product fields to create or update.
     * @param {string} [params.id] - The product ID. When present, triggers an update (PATCH).
     * @returns {Promise<Object>}  - The API response for the created or updated product.
     */
    mutationFn: async ({ body, id }) => {
      if (id) {
        // Update an existing product via PATCH
        return apiFetch(`/api/admin/products/${id}`, {
          getToken,
          method: "PATCH",
          body,
        });
      }
      // Create a new product via POST
      return apiFetch("/api/admin/products", {
        getToken,
        method: "POST",
        body,
      });
    },

    /**
     * Invalidates product-related caches and resets modal/editing state
     * after a successful save operation.
     */
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setModalOpen(false);
      setEditing(null);
    },
  });

  /**
   * Mutation for deleting a product by its ID.
   *
   * On success, invalidates all product-related caches to reflect the removal.
   * On error, logs the error and alerts the user with a readable message.
   *
   * @type {import("@tanstack/react-query").UseMutationResult}
   *
   * @example
   * deleteMutation.mutate("product-123");
   */
  const deleteMutation = useMutation({
    /**
     * @param {string} productId  - The ID of the product to delete.
     * @returns {Promise<Object>} - The API response confirming deletion.
     */
    mutationFn: (productId) =>
      apiFetch(`/api/admin/products/${productId}`, {
        getToken,
        method: "DELETE",
      }),

    /**
     * Invalidates product-related caches after a successful deletion.
     */
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },

    /**
     * Handles deletion errors by logging and displaying an alert to the user.
     *
     * @param {Error|unknown} err - The error thrown during the delete request.
     */
    onError: (err) => {
      console.log(err);
      window.alert(err instanceof Error ? err.message : "Delete failed");
    },
  });

  return {
    getToken,
    isSignedIn,
    meData,
    modalOpen,
    setModalOpen,
    editing,
    setEditing,
    /** Falls back to an empty array if the query has not resolved yet. */
    products: data?.products ?? [],
    isLoading,
    saveMutation,
    deleteMutation,
  };
}
