import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { LoadingFallback } from "./pages/LoadingFallback";
import WebFont from "webfontloader";
import { CollabProvider } from "./contexts/CollabContext";
import CollabRoom from "./pages/CollabRoom";

const Landing = lazy(() =>
  import("./pages/Landing").then((module) => ({
    default: module.Landing,
  }))
);

const PlayGround = lazy(() =>
  import("./pages/PlayGround").then((module) => ({
    default: module.PlayGround,
  }))
);

export const App = () => {
  useEffect(() => {
    // Load fonts
    WebFont.load({
      custom: {
        families: ["Virgil"],
        urls: ["/fonts/Virgil.woff2"],
      },
      active: () => {
        // Font has loaded
        document.documentElement.classList.add("fonts-loaded");
      },
    });
  }, []);

  return (
    <BrowserRouter>
    <CollabProvider>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/board/:id" element={<PlayGround />} />
          <Route path="/collab" element={<CollabRoom />} />
        </Routes>
      </Suspense>
      </CollabProvider>
    </BrowserRouter>
  );
};
