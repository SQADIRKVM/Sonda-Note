"use client";

import { useEffect, useState } from "react";

import { SectionHeading, Spinner } from "@/components/ui";
import { VocabularyManager } from "@/components/vocabulary-manager";
import { fetchVocabulary } from "@/lib/api";
import { getSession } from "@/lib/auth";
import type { VocabularyTerm } from "@/lib/types";

export default function VocabularyPage() {
  const [data, setData] = useState<{ terms: VocabularyTerm[]; industry: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceName = getSession()?.workspace.name ?? "this workspace";

  useEffect(() => {
    fetchVocabulary()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load your vocabulary")
      );
  }, []);

  return (
    <>
      <SectionHeading kicker="The moat" title="Workspace vocabulary" />

      <p className="mb-8 max-w-[560px] text-sm leading-relaxed text-neutral-400">
        Every correction here applies to all future meetings in {workspaceName}. Every team has its own specific vocabulary, brand terms, and product names — this is the layer a generic ASR engine cannot replicate for you.
      </p>

      {error && <p className="text-[13px] text-rose">{error}</p>}

      {!error && !data && (
        <div className="flex justify-center py-16 text-smoke">
          <Spinner />
        </div>
      )}

      {data && <VocabularyManager initialTerms={data.terms} industry={data.industry} />}
    </>
  );
}
