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
    <div className="space-y-6">
      <SectionHeading kicker="The moat" title="Workspace vocabulary" />

      <p className="max-w-[560px] text-xs leading-relaxed text-sn-ink-secondary font-sans -mt-4">
        Every correction here applies to all future meetings in {workspaceName}. Spells your product names, team jargon, and brand terms correctly.
      </p>

      {error && <p className="text-xs text-sn-alert font-sans">{error}</p>}

      {!error && !data && (
        <div className="flex justify-center py-16 text-sn-ink-tertiary">
          <Spinner />
        </div>
      )}

      {data && <VocabularyManager initialTerms={data.terms} industry={data.industry} />}
    </div>
  );
}
