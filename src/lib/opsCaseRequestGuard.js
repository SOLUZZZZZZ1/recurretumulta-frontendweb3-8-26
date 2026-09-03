export function isCurrentOpsCaseRequest({
  requestedCaseId,
  activeCaseId,
  requestGeneration,
  activeGeneration,
  signal = null,
} = {}) {
  return Boolean(
    requestedCaseId &&
      requestedCaseId === activeCaseId &&
      Number.isSafeInteger(requestGeneration) &&
      requestGeneration === activeGeneration &&
      signal?.aborted !== true
  );
}
