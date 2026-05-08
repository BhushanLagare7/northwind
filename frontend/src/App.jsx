import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "@clerk/react";

import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";
import CartPage from "./pages/CartPage";
import CheckoutReturnPage from "./pages/CheckoutReturnPage";
import HomePage from "./pages/HomePage";
import OrderChatPage from "./pages/OrderChatPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import OrdersPage from "./pages/OrdersPage";
import OrderSummaryPage from "./pages/OrderSummaryPage";
import ProductDetailPage from "./pages/ProductDetailPage";

function App() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Layout>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<CartPage />} path="/cart" />
        <Route element={<ProductDetailPage />} path="/product/:slug" />

        <Route
          element={isSignedIn ? <OrdersPage /> : <Navigate replace to="/" />}
          path="/orders"
        />
        <Route element={<CheckoutReturnPage />} path="/checkout/return" />

        {/* NESTED ROUTES */}
        <Route element={<OrderDetailPage />} path="/orders/:id">
          <Route element={<OrderSummaryPage />} index />
          <Route element={<OrderChatPage />} path="chat" />
        </Route>
      </Routes>
    </Layout>
  );
}

export default App;
