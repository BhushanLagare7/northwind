import { Link } from "react-router";

/**
 * Fallback UI component displayed when Sentry catches a runtime error.
 */
export function SentryErrorFallback() {
  return (
    <div className="p-8 mx-auto max-w-md text-center border rounded-box border-base-300 bg-base-100">
      <p className="text-base-content/80">
        Something went wrong. The error was reported.
      </p>

      {/* Provides a way for users to return to the application root */}
      <Link className="mt-6 btn btn-primary btn-sm" to="/">
        Back to shop
      </Link>
    </div>
  );
}
