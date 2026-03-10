import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SessionPage } from "./pages/SessionPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: AuthPage },
      { path: "settings", Component: SettingsPage },
      { path: "session", Component: SessionPage },
    ],
  },
]);
