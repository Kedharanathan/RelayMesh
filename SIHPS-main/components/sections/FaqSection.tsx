"use client";

import { CaretDown } from "@phosphor-icons/react";
import { Section } from "@/components/site/Section";
import { FAQ } from "@/lib/faq";

/**
 * Native details/summary: it is keyboard operable, screen-reader announced and
 * fully functional with JavaScript disabled, which no hand-built accordion is.
 */
export function FaqSection() {
  return (
    <Section
      id="faq"
      title="Questions we get asked first"
      lead="Mostly by people who have built something like this before, and who go straight for the parts we would rather not talk about."
    >
      <div className="reveal grid gap-x-12 lg:grid-cols-2">
        {[FAQ.slice(0, 3), FAQ.slice(3)].map((group, gi) => (
          <div key={gi}>
            {group.map((item) => (
              <details key={item.q} className="faq group border-t border-line">
                <summary className="flex cursor-pointer list-none items-start gap-4 py-4">
                  <h3 className="text-h3 flex-1" style={{ fontWeight: 500 }}>
                    {item.q}
                  </h3>
                  <span
                    className="faq__mark mt-1 shrink-0 text-dim transition-transform duration-300"
                    aria-hidden="true"
                  >
                    <CaretDown size={15} weight="light" aria-hidden="true" />
                  </span>
                </summary>
                <p className="max-w-[62ch] pb-5 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
