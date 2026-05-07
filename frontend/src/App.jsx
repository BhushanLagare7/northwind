import { Route, Routes } from "react-router";
import { useAuth } from "@clerk/react";

import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";
import HomePage from "./pages/HomePage";

function App() {
  const { isLoaded } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Layout>
      <Routes>
        <Route element={<HomePage />} path="/" />
      </Routes>
    </Layout>
  );
}

export default App;
