import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { PlayGround } from "./pages/PlayGround";
export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/board/:id" element={<PlayGround />} />
      </Routes>
    </BrowserRouter>
  );
};
