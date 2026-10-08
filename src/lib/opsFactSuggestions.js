import { FACT_FIELDS, prepareFactReviewProposal } from "./opsFactsReview.js";

const EMPTY = { value: "", documentId: "", page: "", evidence: "", reason: "", checked: false, exclude: false };
const CANDIDATE_STATUSES = new Set(["candidate", "declared", "reviewed", "verified"]);

function inputValue(value, kind) {
  if (value === null || value === undefined) return "";
  if (kind === "boolean") return typeof value === "boolean" ? String(value) : "";
  if (typeof value === "string") return value;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function knownSource(source, documentIds) {
  return source && documentIds.includes(source.document_id);
}

function sourceForm(source) {
  const excerpt = source?.evidence_kind === "document_excerpt" || source?.source_type === "operator_document_review";
  return {
    documentId: source?.document_id || "",
    page: Number.isInteger(source?.page_index) && source.page_index >= 0 && source.page_index < 10000
      ? String(source.page_index + 1) : "",
    evidence: excerpt && typeof source?.evidence === "string" ? source.evidence : "",
  };
}

/**
 * Reads structured observations for this exact facts version. A prefilled form
 * remains a proposal: no notes parsing, document inference or human attestation.
 */
export function factReviewSuggestions(record, workingDocument = null) {
  if (!record?.facts?.facts || !Array.isArray(record.facts.source_document_ids)) return [];
  const bound = workingDocument?.version === "rtm_working_document_v1"
    && workingDocument.case_id === record.case_id
    && workingDocument.facts_id === record.id
    && workingDocument.facts_payload_sha256 === record.payload_sha256;
  const projected = bound && Array.isArray(workingDocument.fields) ? workingDocument.fields : [];
  const keys = new Set([...Object.keys(record.facts.facts), ...projected.map(item => item.key)]);

  return [...keys].filter(key => Object.hasOwn(FACT_FIELDS, key)).map(field => {
    const fact = record.facts.facts[field];
    const observations = projected.filter(item => item.key === field);
    const observation = observations.length === 1 ? observations[0] : null;
    const confirmed = fact?.status === "validated";
    const excluded = fact?.status === "rejected" || observation?.status === "excluded";
    const conflict = !excluded && (fact?.status === "conflicted" || !!fact?.conflicts?.length
      || observation?.status === "conflict" || observations.length > 1);
    const hasCandidate = !excluded && CANDIDATE_STATUSES.has(observation?.status);
    const value = confirmed ? fact.value : hasCandidate ? observation.value : null;
    const reviewedProjection = confirmed && ["reviewed", "verified"].includes(observation?.status) && observation.value === fact.value;
    const sources = (reviewedProjection ? observation.sources : confirmed ? fact.sources : observation?.sources || fact?.sources) || [];
    const availableSources = Array.isArray(sources)
      ? sources.filter(source => knownSource(source, record.facts.source_document_ids)) : [];
    // Prefer a source whose page and fragment are already present, without
    // treating that observation as a documentary review performed by a person.
    const source = availableSources.find(item => {
      const candidate = sourceForm(item);
      return candidate.page && candidate.evidence.trim().length >= 3 && candidate.evidence.length <= 2000;
    }) || availableSources[0];
    const form = {
      ...EMPTY, ...sourceForm(source),
      value: conflict && !confirmed ? "" : inputValue(value, FACT_FIELDS[field][1]),
      reason: "Revisión de los datos documentales disponibles.",
    };
    const missing = [];
    if (!form.value.trim()) missing.push("valor");
    if (!form.documentId) missing.push("documento de origen");
    if (!form.page) missing.push("página");
    if (form.evidence.trim().length < 3 || form.evidence.length > 2000) missing.push("fragmento del original");
    const proposal = {
      ...form, field, sourceHash: record.payload_sha256,
      operation: fact ? "correct" : "add", originalValue: fact?.value ?? null,
      origin: confirmed ? "reviewed" : observation?.status || "missing",
    };
    let ready = false;
    let validationMessage = "";
    if (!missing.length && !conflict && !excluded) {
      try {
        proposal.previewValue = prepareFactReviewProposal({ ...proposal, record }).changes[0].value;
        ready = true;
      } catch (error) { validationMessage = error.message; }
    }
    return {
      field, label: FACT_FIELDS[field][0], confirmed, conflict, excluded,
      value, sources: availableSources, form, proposal, ready, missing, validationMessage,
      candidate: !confirmed && hasCandidate,
    };
  });
}

export function prepareAvailableFactProposals(record, workingDocument, prepared = []) {
  const existing = new Set(prepared.map(item => item.field));
  const available = factReviewSuggestions(record, workingDocument)
    .filter(item => item.ready && !item.confirmed && !existing.has(item.field));
  // Manual proposals always win. A newly prepared set requires its own review.
  return [...prepared.map(item => ({ ...item, checked: false })), ...available.map(item => item.proposal)];
}
