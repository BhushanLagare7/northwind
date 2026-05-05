import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";

import "./App.css";

function App() {
  return (
    <>
      <header>
        <Show when="signed-out">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>
    </>
  );
}

export default App;
