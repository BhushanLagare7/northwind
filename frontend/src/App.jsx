import {
  Show,
  SignInButton,
  SignUpButton,
  useAuth,
  UserButton,
} from "@clerk/react";

import Layout from "./components/Layout";
import PageLoader from "./components/PageLoader";

function App() {
  const { isLoaded } = useAuth();

  if (!isLoaded) return <PageLoader />;

  return (
    <Layout>
      <header>
        <Show when="signed-out">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
    </Layout>
  );
}

export default App;
