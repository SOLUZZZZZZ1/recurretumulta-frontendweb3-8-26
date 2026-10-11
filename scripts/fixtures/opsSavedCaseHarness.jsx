// Synthetic verification harness only; not imported by the application.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { OpsTestProvider } from "../../src/ops-auth/OpsAuthContext.jsx";
import OpsCaseDetail from "../../src/pages/OpsCaseDetail.jsx";
function Harness() {
  const navigate = useNavigate();
  useEffect(() => { window.rtmTestNavigate = navigate; }, [navigate]);
  return <Routes><Route path="/ops/case/:caseId" element={<OpsCaseDetail />} /></Routes>;
}
createRoot(document.getElementById("root")).render(<OpsTestProvider>
  <MemoryRouter initialEntries={[`/ops/case/${window.rtmInitialCase}`]}><Harness /></MemoryRouter>
</OpsTestProvider>);
