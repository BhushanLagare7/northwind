/**
 * @fileoverview Admin form component for creating and editing store products.
 * Handles product field management, image uploads via ImageKit, and
 * smart diff-based patching for edits.
 */

import { useState } from "react";

import { uploadImageToImageKit } from "../lib/imagekitUpload.js";
import { IK_PRESETS, imageKitOptimizedUrl } from "../lib/imagekitUrl.js";

/**
 * A form for creating or editing a product in the admin panel.
 *
 * - In **create mode** (`initial` is undefined/null): submits the full product body.
 * - In **edit mode** (`initial` is provided): computes a patch object containing
 *   only the changed fields and submits that instead. If nothing changed, cancels.
 *
 * @param {Object}        props
 * @param {Object|null}   props.initial          - Existing product data for edit mode; omit for create mode.
 * @param {string}        props.initial.slug      - URL-safe unique identifier (not editable after creation).
 * @param {string}        props.initial.name      - Display name.
 * @param {string}        props.initial.category  - Product category label.
 * @param {string}        props.initial.description - Long-form product description.
 * @param {number}        props.initial.priceCents  - Price stored in cents (e.g. 999 = $9.99).
 * @param {string}        props.initial.currency    - ISO currency code (e.g. "usd").
 * @param {string|null}   props.initial.imageUrl    - Public image URL.
 * @param {string|null}   props.initial.imageKitFileId - ImageKit file ID tied to the current image.
 * @param {boolean}       props.initial.active      - Whether the product is visible in the store.
 * @param {boolean}       props.saving           - Disables the submit button and shows a spinner while true.
 * @param {string|null}   props.error            - If set, renders a save-failure alert.
 * @param {Function}      props.getToken         - Async function that resolves an auth token for ImageKit uploads.
 * @param {Function}      props.onCancel         - Called when the user cancels or no editable fields changed.
 * @param {Function}      props.onSubmit         - Called with the full body (create) or patch object (edit).
 *
 * @returns {JSX.Element} The rendered product form.
 */
export function AdminProductForm({
  initial,
  saving,
  error,
  getToken,
  onCancel,
  onSubmit,
}) {
  // ── Form field state ────────────────────────────────────────────────────────

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "General");
  const [description, setDescription] = useState(initial?.description ?? "");

  /** Price is kept as a decimal string (e.g. "9.99") for the number input. */
  const [priceCents, setPriceCents] = useState(
    initial ? String(initial.priceCents / 100) : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "usd");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");

  /** ImageKit file ID; cleared when the user manually types a new URL. */
  const [imageKitFileId, setImageKitFileId] = useState(
    initial?.imageKitFileId ?? "",
  );
  const [active, setActive] = useState(initial?.active ?? true);

  // ── Image-upload state ──────────────────────────────────────────────────────

  /** True while an image is being uploaded to ImageKit. */
  const [uploadingImage, setUploadingImage] = useState(false);

  /** Holds a human-readable upload error message, or null when there is none. */
  const [uploadError, setUploadError] = useState(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Handles form submission.
   *
   * - Validates that price is a positive number.
   * - In edit mode, diffs the new values against `initial` and only submits
   *   changed fields. Calls `onCancel` if nothing changed.
   * - In create mode, submits the full product body.
   *
   * @param {React.SubmitEvent<HTMLFormElement>} e - The form submit event.
   */
  function handleSubmit(e) {
    e.preventDefault();

    const dollars = Number.parseFloat(priceCents);
    if (Number.isNaN(dollars) || dollars <= 0) return;

    /** Normalized product body built from current field state. */
    const body = {
      slug: slug.trim(),
      name: name.trim(),
      category: category.trim() || "General",
      description: description.trim(),
      priceCents: Math.round(dollars * 100),
      currency: currency.trim().toLowerCase(),
      imageUrl: imageUrl.trim() || null,
      imageKitFileId: imageKitFileId.trim() || null,
      active,
    };

    if (initial) {
      // Edit mode: build a patch with only the changed fields.
      const patch = {};
      if (body.name !== initial.name) patch.name = body.name;
      if (body.category !== (initial.category ?? "General"))
        patch.category = body.category;
      if (body.description !== initial.description)
        patch.description = body.description;
      if (body.priceCents !== initial.priceCents)
        patch.priceCents = body.priceCents;
      if (body.currency !== initial.currency) patch.currency = body.currency;
      if ((body.imageUrl ?? "") !== (initial.imageUrl ?? ""))
        patch.imageUrl = body.imageUrl;
      if ((body.imageKitFileId ?? null) !== (initial.imageKitFileId ?? null)) {
        patch.imageKitFileId = body.imageKitFileId;
      }
      if (body.active !== initial.active) patch.active = body.active;

      // Nothing changed — treat as a cancel.
      if (Object.keys(patch).length === 0) {
        onCancel();
        return;
      }
      onSubmit(patch);
    } else {
      // Create mode: submit the full body.
      onSubmit(body);
    }
  }

  /**
   * Handles image file selection and upload to ImageKit.
   *
   * - Rejects files larger than 10 MB.
   * - Derives a sanitized filename from the current slug and the original extension.
   * - On success, updates `imageUrl` and `imageKitFileId` state.
   * - On failure, surfaces an error message via `uploadError`.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event.
   */
  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after an error.
    e.target.value = "";
    if (!file) return;

    setUploadError(null);

    // Guard: reject files over 10 MB before hitting the network.
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File is too large (max 10MB).");
      return;
    }

    // Build a deterministic, URL-safe filename: <slug>-<timestamp>.<ext>
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : ".jpg";
    const base = (slug.trim() || "product")
      .replace(/[^\w-]+/g, "-")
      .slice(0, 80);

    setUploadingImage(true);

    try {
      const { url, fileId } = await uploadImageToImageKit(file, getToken, {
        fileName: `${base}-${Date.now()}${ext}`,
      });

      setImageUrl(url);
      setImageKitFileId(fileId ?? "");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <form className="flex flex-col gap-3 mt-4" onSubmit={handleSubmit}>
      {/* Slug — read-only when editing an existing product */}
      <label className="w-full form-control">
        <span className="label-text">Slug</span>
        <input
          className="w-full input input-bordered"
          disabled={Boolean(initial)}
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>

      {/* Product display name */}
      <label className="w-full form-control">
        <span className="label-text">Name</span>
        <input
          className="w-full input input-bordered"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {/* Category label shown in the storefront */}
      <label className="w-full form-control">
        <span className="label-text">Category</span>
        <input
          className="w-full input input-bordered"
          placeholder="e.g. Audio, Workspace"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </label>

      {/* Long-form product description */}
      <label className="w-full form-control">
        <span className="label-text">Description</span>
        <textarea
          className="w-full h-24 textarea textarea-bordered"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      {/* Price and currency side-by-side */}
      <div className="grid grid-cols-2 gap-2">
        <label className="form-control">
          <span className="label-text">Price (USD)</span>
          <input
            className="input input-bordered"
            min="0.01"
            required
            step="0.01"
            type="number"
            value={priceCents}
            onChange={(e) => setPriceCents(e.target.value)}
          />
        </label>

        <label className="form-control">
          <span className="label-text">Currency</span>
          <input
            className="input input-bordered"
            required
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </label>
      </div>

      {/* Image section: file upload button + manual URL input + preview */}
      <div className="w-full form-control">
        <span className="label-text">Image</span>

        {/* Hidden file input triggered by the styled button */}
        <label className="flex flex-wrap gap-2 items-center mb-2 cursor-pointer">
          <span className="btn btn-secondary btn-sm shrink-0">
            {uploadingImage ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Upload to ImageKit"
            )}
          </span>

          <span className="text-xs text-base-content/60">
            PNG, JPG, WebP, GIF · max 10MB
          </span>

          <input
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={uploadingImage || saving}
            type="file"
            onChange={handleImageUpload}
          />
        </label>

        {/* Manual URL override — clears imageKitFileId if changed */}
        <label className="py-0 label">
          <span className="label-text-alt text-base-content/60">
            Image URL (any HTTPS URL)
          </span>
        </label>
        <input
          className="w-full input input-bordered"
          placeholder="https://..."
          type="url"
          value={imageUrl}
          onChange={(e) => {
            const v = e.target.value;
            // Disassociate the ImageKit file ID when the URL is changed manually.
            if (v !== imageUrl) setImageKitFileId("");
            setImageUrl(v);
          }}
        />

        {/* Upload error message */}
        {uploadError ? (
          <span className="mt-1 text-xs text-error" role="alert">
            {uploadError}
          </span>
        ) : null}

        {/* Live image preview using an ImageKit-optimized thumbnail URL */}
        {imageUrl ? (
          <div className="overflow-hidden p-2 mt-2 rounded-lg border border-base-300 bg-base-200">
            <img
              alt=""
              className="object-contain mx-auto w-auto max-h-32"
              decoding="async"
              src={imageKitOptimizedUrl(imageUrl, IK_PRESETS.formPreview)}
            />
          </div>
        ) : null}
      </div>

      {/* Active toggle — controls storefront visibility */}
      <label className="gap-3 justify-start cursor-pointer label">
        <input
          checked={active}
          className="toggle toggle-primary"
          type="checkbox"
          onChange={(e) => setActive(e.target.checked)}
        />
        <span className="label-text">Active in store</span>
      </label>

      {/* Server-side save error banner */}
      {error ? (
        <div className="text-sm alert alert-error" role="alert">
          Save failed (check slug unique &amp; fields).
        </div>
      ) : null}

      {/* Form actions */}
      <div className="modal-action">
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={saving || uploadingImage}
          type="submit"
        >
          {saving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}
