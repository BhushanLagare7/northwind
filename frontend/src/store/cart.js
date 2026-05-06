/**
 * @fileoverview Shopping cart state management using Zustand with localStorage persistence.
 * This module provides a global cart store that automatically saves cart data
 * to localStorage under the key "northwind-cart".
 *
 * @module store/cart
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * @typedef {Object} CartItem
 * @property {string|number} productId - The unique identifier of the product
 * @property {number} quantity - The quantity of the product in the cart
 */

/**
 * @typedef {Object} CartStore
 * @property {CartItem[]} items - Array of items currently in the cart
 * @property {function} addItem - Adds a product to the cart or increments its quantity
 * @property {function} removeItem - Removes a product from the cart entirely
 * @property {function} setQty - Sets the exact quantity for a specific cart item
 * @property {function} clear - Removes all items from the cart
 */

/**
 * Global shopping cart store with localStorage persistence.
 *
 * The cart state is automatically saved to and restored from localStorage,
 * ensuring that cart contents survive page refreshes and browser sessions.
 *
 * @type {import('zustand').UseBoundStore<CartStore>}
 *
 * @example
 * // Access cart items
 * const items = useCart((state) => state.items);
 *
 * @example
 * // Destructure multiple actions
 * const { addItem, removeItem, clear } = useCart();
 */
export const useCart = create(
  persist(
    /**
     * Cart store initializer function
     *
     * @param {function} set - Zustand setter function to update store state
     * @param {function} get - Zustand getter function to access current store state
     * @returns {CartStore} The cart store object containing state and actions
     */
    (set, get) => ({
      /**
       * List of items currently in the shopping cart.
       * Each item contains a productId and quantity.
       *
       * @type {CartItem[]}
       */
      items: [],

      /**
       * Adds a product to the cart. If the product already exists in the cart,
       * its quantity is incremented by the specified amount instead.
       *
       * @param {string|number} productId - The unique identifier of the product to add
       * @param {number} [qty=1] - The quantity to add (defaults to 1)
       * @returns {void}
       *
       * @example
       * const addItem = useCart((state) => state.addItem);
       * addItem("product-123");         // Adds 1 unit
       * addItem("product-123", 3);      // Adds 3 more units
       */
      addItem(productId, qty = 1) {
        const items = [...get().items];
        const i = items.findIndex((item) => item.productId === productId);

        if (i >= 0) {
          // Product already exists in cart — increment quantity
          items[i] = { ...items[i], quantity: items[i].quantity + qty };
        } else {
          // Product is new to cart — add as a new entry
          items.push({ productId, quantity: qty });
        }

        set({ items });
      },

      /**
       * Removes a product from the cart entirely, regardless of its quantity.
       *
       * @param {string|number} productId - The unique identifier of the product to remove
       * @returns {void}
       *
       * @example
       * const removeItem = useCart((state) => state.removeItem);
       * removeItem("product-123");    // Removes the product completely from the cart
       */
      removeItem(productId) {
        set({
          items: get().items.filter((item) => item.productId !== productId),
        });
      },

      /**
       * Sets the exact quantity of a specific product in the cart.
       * If the quantity is set to 0 or below, the product is removed from the cart.
       *
       * @param {string|number} productId - The unique identifier of the product to update
       * @param {number} quantity - The new quantity to set for the product
       * @returns {void}
       *
       * @example
       * const setQty = useCart((state) => state.setQty);
       * setQty("product-123", 5);    // Sets the quantity to 5
       * setQty("product-123", 0);    // Removes the product from cart
       * setQty("product-123", -1);   // Also removes the product from cart
       */
      setQty(productId, quantity) {
        if (quantity <= 0) {
          // Remove item from cart if quantity drops to zero or below
          set({
            items: get().items.filter((item) => item.productId !== productId),
          });
          return;
        }

        // Update quantity for the matching product, leave others unchanged
        const items = get().items.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        );

        set({ items });
      },

      /**
       * Clears all items from the shopping cart, resetting it to an empty state.
       *
       * @returns {void}
       *
       * @example
       * const clear = useCart((state) => state.clear);
       * clear();    // Empties the entire cart
       */
      clear() {
        set({ items: [] });
      },
    }),

    /**
     * Persistence configuration for the cart store.
     * Saves the cart state to localStorage under the specified key.
     *
     * @type {import('zustand/middleware').PersistOptions<CartStore>}
     */
    { name: "northwind-cart" },
  ),
);
