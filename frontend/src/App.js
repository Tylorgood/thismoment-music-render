import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import MusicLibrary from "@/pages/MusicLibrary";
import { Toaster } from "@/components/ui/sonner";

function App() {
  useEffect(() => {
    document.title =
      "This Moment Studio — Live shows. Private events. Unforgettable moments.";
    const desc = document.querySelector('meta[name="description"]');
    const content =
      "This Moment Studio designs cinematic live shows, private events and creative productions. Soundtracks for the moments that define you.";
    if (desc) {
      desc.setAttribute("content", content);
    } else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/music" element={<MusicLibrary />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "#121110",
            color: "#fff",
            border: "1px solid rgba(212,175,55,0.3)",
          },
        }}
      />
    </div>
  );
}

export default App;
