import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { NewRepairForm } from "./components/NewRepairForm";
import Home from "@/pages/Home";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewRepairForm />} />
      </Routes>
    </Router>
  );
}

export default App;
