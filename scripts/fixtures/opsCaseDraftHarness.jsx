// Isolated component test: no real operator session or backend is used here.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OpsCaseWorkingDocument from '../../src/components/OpsCaseWorkingDocument.jsx';
const authFetch = (url, options) => fetch(url, options);
function Harness() {
  const [caseId, setCase] = useState(window.testCaseId), [sessionId, setSession] = useState('unit-session-one');
  window.draftHarness = { setCase, setSession };
  return <OpsCaseWorkingDocument authFetch={authFetch} caseId={caseId} sessionId={sessionId} enabled={!!sessionId} />;
}
createRoot(document.getElementById('root')).render(<Harness />);
