import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/react";

import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";
import CartPage from "./pages/CartPage";
import CheckoutReturnPage from "./pages/CheckoutReturnPage";
import HomePage from "./pages/HomePage";
import OrdersPage from "./pages/OrdersPage";

function App() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Layout>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<CartPage />} path="/cart" />
        <Route
          element={isSignedIn ? <OrdersPage /> : <Navigate replace to="/" />}
          path="/orders"
        />
        <Route element={<CheckoutReturnPage />} path="/checkout/return" />
      </Routes>
    </Layout>
  );
}

export default App;
