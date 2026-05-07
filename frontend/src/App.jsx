import { Route, Routes } from "react-router";
import { useAuth } from "@clerk/react";

import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";
import CartPage from "./pages/CartPage";
import HomePage from "./pages/HomePage";

function App() {
  const { isLoaded } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Layout>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<CartPage />} path="/cart" />
      </Routes>
    </Layout>
  );
}

export default App;
