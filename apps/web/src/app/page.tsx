"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PinnedStage } from "./_components/pinned-stage";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* SVG Wobble Filter */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="wobble" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* ─── Sticky Header — Granola pill nav ─── */}
      <header className="navbar-header" id="hdr" data-scrolled={scrolled ? "true" : "false"}>
        <div className="mx-auto w-full max-w-7xl px-4 md:px-10">
          <nav
            data-scrolled={scrolled ? "true" : "false"}
            className="navbar-pill flex items-center flex-none h-14"
          >
            <div className="flex gap-1 items-center w-full py-2">
              {/* Wordmark */}
              <div className="flex flex-1 items-center">
                <Link href="#top" aria-label="Sonda Note home" className="md:pl-1">
                  <span className="font-serif text-[23px] leading-none">
                    Sonda<span style={{ color: "var(--olive)" }}>.</span>
                  </span>
                </Link>
              </div>

              {/* Desktop nav links */}
              <div className="hidden md:flex items-center justify-center gap-0">
                {[
                  { href: "#how", label: "How it works" },
                  { href: "#words", label: "Your words" },
                  { href: "#ask", label: "Search" },
                  { href: "#privacy", label: "Privacy" },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="hidden select-none px-3 md:flex items-center text-[15.5px] leading-6 text-[var(--ink-2)] transition-colors duration-200 py-1.5 rounded-full hover:text-[var(--ink)] hover:bg-[rgba(25,26,20,0.055)]"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              {/* CTA button */}
              <div className="flex flex-1 items-center justify-end">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[#FBF9F4] text-[15px] px-5 h-11 transition-colors hover:bg-[#2E3026] flex-none ml-1"
                >
                  Add to Chrome
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ═════ PIN ZONE ═════ */}
        <PinnedStage />

        {/* ═════ GIANT HEADLINE + WALL ═════ */}
        <section className="doers">
          <div className="wrap">
            <h2 id="doers">For the doers</h2>
          </div>
          <div className="wall">
            <div className="wrap">
              <p>Built for teams who switch languages mid-sentence</p>
              <div className="wallgrid">
                <span>Engineering</span>
                <span>Product</span>
                <span>Sales</span>
                <span>Support</span>
                <span>Founders</span>
                <span>Agencies</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═════ CORRECTION MOTIF ═════ */}
        <section className="fix">
          <div className="wrap">
            <p className="lead">Every transcriber hears this. Only one of them fixes it.</p>
            <div className="fixrow">
              <span className="was">super base migration</span>
              <span className="arrow">becomes</span>
              <span className="now">
                <b>Supabase migration</b>
              </span>
            </div>
            <div className="fixrow">
              <span className="was">raise pay sandbox</span>
              <span className="arrow">becomes</span>
              <span className="now">
                <b>Razorpay sandbox</b>
              </span>
            </div>
            <div className="fixrow">
              <span className="was">figure ma file link</span>
              <span className="arrow">becomes</span>
              <span className="now">
                <b>Figma file link</b>
              </span>
            </div>
          </div>
        </section>

        {/* ═════ DOCUMENT ═════ */}
        <section className="docband" id="notes">
          <div className="wrap">
            <div className="doc">
              <div className="meta">
                <span>Thursday, 6 August</span>
                <span>42 minutes</span>
              </div>
              <h3>Sprint sync — payments &amp; migration</h3>
              <p className="who">Sarhan, Anand, Devika</p>

              <h4>What happened</h4>
              <p>
                The settings page designs are done and going into review today. The{" "}
                <span className="tag">Supabase migration</span> script has been written but not yet tested
                against staging. Payments is the open risk: the <span className="tag">Razorpay</span> webhook
                is timing out in sandbox, which blocks the dashboard release.
              </p>

              <h4>Decisions</h4>
              <ul>
                <li>
                  Ship the dashboard today <em>only</em> if the webhook timeout is resolved by 4pm.
                </li>
                <li>Migration testing moves ahead of the vocabulary manager this sprint.</li>
              </ul>

              <h4>In their words</h4>
              <p>
                &ldquo;Designs for settings page ready aanu. Today{" "}
                <span className="tag">Supabase migration</span> test cheyyanam. Sandbox issue undarnnu, but
                yesterday resolve aayi.&rdquo;
                <span className="stamp">Sarhan · 00:14</span>
              </p>

              <h4>Follow-ups</h4>
              <ul>
                <li>Anand — reproduce the webhook timeout with a longer retry window.</li>
                <li>Sarhan — run the migration against staging before standup.</li>
                <li>Devika — move the settings designs into review.</li>
              </ul>

              <div className="foot">Every line above links back to the second it was said.</div>
            </div>
          </div>
        </section>

        {/* ═════ TESTIMONIAL ═════ */}
        <section className="quote">
          <div className="wrap">
            <blockquote>
              &ldquo;We stopped writing minutes. Nobody noticed, because the notes were already better.&rdquo;
            </blockquote>
            <div className="by">
              <b>Engineering lead</b>
              <span>Fintech team of 14 · Kochi</span>
            </div>
          </div>
        </section>

        {/* ═════ VOCABULARY BAND ═════ */}
        <section className="band butter" id="words">
          <div className="wrap">
            <h2>It learns the words only your team uses.</h2>
            <div className="vocab">
              <div className="vrow">
                <span className="l">super base migration</span>
                <span className="c">database</span>
                <span className="r">Supabase migration</span>
              </div>
              <div className="vrow">
                <span className="l">raise pay sandbox</span>
                <span className="c">payments</span>
                <span className="r">Razorpay sandbox</span>
              </div>
              <div className="vrow">
                <span className="l">figure ma file link</span>
                <span className="c">design</span>
                <span className="r">Figma file link</span>
              </div>
              <div className="vrow">
                <span className="l">sounder note</span>
                <span className="c">product</span>
                <span className="r">Sonda Note</span>
              </div>
              <div className="vrow">
                <span className="l">neon serverless post grace</span>
                <span className="c">infra</span>
                <span className="r">Neon serverless Postgres</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═════ SEARCH / ASK BAND ═════ */}
        <section className="band" id="ask">
          <div className="wrap">
            <h2>Ask what was decided six months ago.</h2>
            <div className="answer">
              <p className="q">Who owns the payment gateway rewrite?</p>
              <blockquote>
                &ldquo;Razorpay sandbox check cheythitt, dashboard deploy cheyyanam today.&rdquo;
              </blockquote>
              <div className="src">
                <span>Anand · Sprint sync · 6 August</span>
                <a href="#notes" className="play">
                  ▸ Play from 00:28
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ═════ PRIVACY BAND ═════ */}
        <section className="band blush" id="privacy">
          <div className="wrap">
            <h2>Three things we don't do.</h2>
            <div className="three">
              <div>
                <h3>Join your call</h3>
                <p>
                  Sonda listens through your browser tab. No fourth participant appears, so nobody changes how
                  they speak.
                </p>
              </div>
              <div>
                <h3>Mix your data with anyone's</h3>
                <p>
                  Each workspace is isolated at the database row, not just filtered in the application layer.
                </p>
              </div>
              <div>
                <h3>Keep it once you've asked us not to</h3>
                <p>
                  Export everything as plain text, or destroy everything. Deletion is immediate and total.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═════ FINAL CTA ═════ */}
        <section className="final" id="get">
          <div className="wrap">
            <h2>Ready when your next meeting is.</h2>
            <p>About ten seconds to install. Free forever for individuals, and no card to start a team.</p>
            <div className="cta">
              <Link href="/login" className="btn light">
                Add to Chrome — free
              </Link>
              <Link href="/login" className="tlink">
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ═════ FOOTER ═════ */}
      <footer className="site-footer">
        <div className="wrap">
          <div className="fgrid">
            <div>
              <p className="about">
                Sonda<span style={{ color: "#8E9179" }}>.</span>
              </p>
              <p>Meeting notes for teams who don't speak one language at a time. Built in Kerala.</p>
            </div>
            <div>
              <h5>Product</h5>
              <Link href="#how">How it works</Link>
              <Link href="#words">Vocabulary</Link>
              <Link href="#ask">Search</Link>
            </div>
            <div>
              <h5>Company</h5>
              <Link href="#get">Pricing</Link>
              <Link href="#get">Changelog</Link>
              <Link href="#get">Contact</Link>
            </div>
            <div>
              <h5>Legal</h5>
              <Link href="#privacy">Privacy</Link>
              <Link href="#privacy">Security</Link>
              <Link href="#privacy">Terms</Link>
            </div>
          </div>
          <p className="fbot">Sonda Note — by Atmiz</p>
        </div>
      </footer>
    </>
  );
}
