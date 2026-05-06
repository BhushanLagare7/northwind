import Footer from "./Footer";
import Navbar from "./Navbar";

/**
 * Main application layout wrapper.
 * Provides consistent page structure with a sticky Footer and responsive container.
 */
function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-svh bg-base-200 text-base-content">
      <Navbar />

      {/* Main content area with responsive padding and max-width */}
      <main className="flex-1 px-4 py-8 mx-auto w-full max-w-7xl md:px-6 md:py-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export default Layout;
