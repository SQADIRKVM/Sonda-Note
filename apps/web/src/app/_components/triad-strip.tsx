import React from "react";
import { Display } from "./display";
import { Eyebrow } from "./eyebrow";

export function TriadStrip() {
  const statements = [
    {
      title: "Zero Bot Participants",
      body: "Uses your computer audio, so no bot joins the call.",
      highlight: "so no bot joins the call.",
    },
    {
      title: "Code-Mixed Speech",
      body: "Manglish is native, not a translation afterthought.",
      highlight: "Manglish is native,",
    },
    {
      title: "Private by Default",
      body: "Row-level isolation, yours to export or delete.",
      highlight: "Row-level isolation,",
    },
  ];

  return (
    <div className="text-center space-y-12">
      <div>
        <Eyebrow text="THE SONDA STANDARD" />
        <Display as="h2" size="h2" className="max-w-mid mx-auto">
          Effortless notes, in the language you actually speak.
        </Display>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-b border-sn-hairline divide-y md:divide-y-0 md:divide-x divide-sn-hairline bg-sn-surface rounded-[12px]">
        {statements.map((item, idx) => (
          <div key={idx} className="p-8 text-left space-y-2.5">
            <span className="font-mono text-xs text-sn-ink-tertiary">0{idx + 1}</span>
            <h3 className="font-serif text-lg font-normal text-sn-ink">{item.title}</h3>
            <p className="text-sm font-sans text-sn-ink-secondary leading-relaxed">
              {item.body.split(item.highlight).map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="font-medium text-sn-ink">{item.highlight}</span>
                  )}
                </React.Fragment>
              ))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
