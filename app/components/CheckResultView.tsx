import { Fragment, useEffect, useState } from "react";
import type { CheckResult, Verdict } from "../../lib/types";

// Verdict colors are conveyed with emoji markers in the markup itself, and
// data-verdict attributes are the hooks app/globals.css styles.
export const VERDICT_MARKERS: Record<Verdict, string> = {
  Supported: "🟢",
  Contradicted: "🔴",
  Unsupported: "🟡",
};

export function VerdictLabel({ verdict }: { verdict: Verdict }) {
  return (
    <span data-verdict={verdict}>
      <span aria-hidden="true">{VERDICT_MARKERS[verdict]}</span> {verdict}
    </span>
  );
}

export function VerdictLegend() {
  return (
    <p data-role="legend">
      Legend: <VerdictLabel verdict="Supported" /> <VerdictLabel verdict="Contradicted" /> <VerdictLabel verdict="Unsupported" />
    </p>
  );
}

/** Render text with its line breaks, without interpreting it as HTML. */
export function MultilineText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
}

export function formatScore(value: number | null, suffix: string): string {
  return value === null ? "N/A" : `${value}${suffix}`;
}

export function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * True for a moment after a result first renders. The stylesheet stamps the verdict
 * seals in only while it is set, so the animation plays once when a check lands and
 * not again each time the mode is shown.
 */
function useFresh(ms = 2000): boolean {
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setFresh(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return fresh;
}

export function CheckResultView({ result }: { result: CheckResult }) {
  const { counts, metrics } = result;
  const fresh = useFresh();
  return (
    <article aria-label="Check result" data-fresh={fresh ? "true" : undefined}>
      <h3>Evaluation scores</h3>
      <dl>
        <dt>Faithfulness</dt>
        <dd>
          {metrics.faithfulness === null
            ? "N/A (the answer makes no factual claims)"
            : `${metrics.faithfulness}% (${counts.supported} of ${plural(counts.total, "claim")} supported)`}
        </dd>
        <dt>Answer Relevance</dt>
        <dd>{metrics.answerRelevance}/100 — {metrics.answerRelevanceReason}</dd>
        <dt>Context Relevance</dt>
        <dd>{metrics.contextRelevance}/100 — {metrics.contextRelevanceReason}</dd>
        <dt>Verdicts</dt>
        <dd data-role="verdict-counts">
          <span><VerdictLabel verdict="Supported" /> {counts.supported}</span>{" "}
          <span><VerdictLabel verdict="Contradicted" /> {counts.contradicted}</span>{" "}
          <span><VerdictLabel verdict="Unsupported" /> {counts.unsupported}</span>
        </dd>
        <dt>Mode</dt>
        <dd>
          {result.strictnessMode
            ? `Healthcare Strictness (Supported requires a literal match and confidence ≥ ${result.supportThreshold})`
            : "Standard"}
        </dd>
        <dt>Checked by</dt>
        <dd>{result.model} in {(result.durationMs / 1000).toFixed(1)} s</dd>
      </dl>

      <h3>Extracted claims ({counts.total})</h3>
      {result.claims.length === 0 ? (
        <p>No factual claims were found in the answer.</p>
      ) : (
        <table data-role="claims">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Claim</th>
              <th scope="col">Verdict</th>
              {result.strictnessMode ? <th scope="col">Literal match</th> : null}
              <th scope="col">Confidence</th>
              <th scope="col">Evidence (quote from context)</th>
              <th scope="col">Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {result.claims.map((claim, index) => (
              <tr key={claim.id} data-verdict={claim.verdict}>
                <td data-label="#">{index + 1}</td>
                <td data-label="Claim">{claim.claim}</td>
                <td data-label="Verdict">
                  <VerdictLabel verdict={claim.verdict} />
                  {claim.modelVerdict !== claim.verdict ? (
                    <>
                      <br />
                      <small>(model said {claim.modelVerdict})</small>
                    </>
                  ) : null}
                </td>
                {result.strictnessMode ? <td data-label="Literal match">{claim.literalMatch === null ? "—" : claim.literalMatch ? "Yes" : "No"}</td> : null}
                <td data-label="Confidence">{claim.confidence.toFixed(2)}</td>
                <td data-label="Evidence">
                  {claim.evidence ? <q>{claim.evidence}</q> : <em>No evidence in context</em>}
                  {claim.evidence && !claim.evidenceFound ? (
                    <>
                      <br />
                      <small>Not found verbatim in the context.</small>
                    </>
                  ) : null}
                </td>
                <td data-label="Reasoning">
                  {claim.reasoning}
                  {claim.adjustments.map((adjustment) => (
                    <Fragment key={adjustment}>
                      <br />
                      <small>{adjustment}</small>
                    </Fragment>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
