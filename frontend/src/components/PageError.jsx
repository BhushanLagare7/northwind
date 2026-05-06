import { Link } from "react-router";

/**
 * Error UI component displayed for runtime errors.
 */
export function PageError({ message, action }) {
  return (
    <div
      className="p-8 text-center border rounded-box border-base-300 bg-base-100"
      role="alert"
    >
      <p className="text-base-content/70">{message}</p>
      {/* Provides ability for users to retry the action */}
      {action ? (
        <Link className="mt-4 btn btn-primary btn-sm" to={action.to}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
