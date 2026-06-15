import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { NewRepairForm } from "./components/NewRepairForm";
import Home from "@/pages/Home";
import ImportWorkbench from "@/pages/ImportWorkbench";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewRepairForm />} />
        <Route path="/import-workbench" element={<ImportWorkbench />} />
      </Routes>
    </Router>
  );
}

export default App;
