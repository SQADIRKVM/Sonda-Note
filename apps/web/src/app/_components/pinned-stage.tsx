"use client";

import { useEffect, useRef, useState } from "react";

export function PinnedStage() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  // Parallax offsets
  const [p1Y, setP1Y] = useState(0);
  const [p2Y, setP2Y] = useState(0);
  const [p3Y, setP3Y] = useState(0);
  const [vcallY, setVcallY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);

      const zone = zoneRef.current;
      if (!zone) return;

      const zr = zone.getBoundingClientRect();
      const vh = window.innerHeight;
      const travel = zone.offsetHeight - vh;

      let p = travel > 40 ? Math.min(Math.max(-zr.top / travel, 0), 1) : 1;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        p = 1;
      }
      setProgress(p);

      // Parallax calculations
      const center = vh / 2;
      const stageEl = zone.querySelector(".stage");
      if (stageEl) {
        const sr = stageEl.getBoundingClientRect();
        const d = sr.top + sr.height / 2 - center;
        setP1Y(-d * 0.1);
        setP2Y(-d * 0.16);
        setP3Y(-d * 0.06);
        setVcallY(-d * -0.18);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const c1On = progress > 0.03 && progress < 0.34;
  const c2On = progress >= 0.34 && progress < 0.52;
  const rawOpacity = progress < 0.42 ? 1 : 0.22;
  const wipe = Math.min(Math.max((progress - 0.42) / 0.3, 0), 1);
  const clipInset = (1 - wipe) * 100;
  const tgOn = progress > 0.8;
  const tgSlid = progress > 0.86;

  return (
    <div ref={zoneRef} className="pinzone" id="zone">
      <div className="wrap pingrid">
        {/* Left Scroll Column */}
        <div className="scrollcol">
          {/* Hero Block */}
          <div className="heroblock">
            <a href="#words" className="ann">
              <span className="new">New</span>
              <span className="txt">Vocabulary that learns your team</span>
              <svg className="arw" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 8h9m0 0L9 4.5M12.5 8L9 11.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>

            <h1 className="big">Notes that understand Manglish</h1>

            <div className="herosub">
              <p>
                <b>Malayalam and English, one sentence.</b>
              </p>
              <p>Without a meeting bot.</p>
            </div>

            <div className="herocta">
              <a href="#get" className="btn">
                Add to Chrome — free
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18.25 14L12 20.25L5.75 14M12 19.5V3.75"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <p className="avail">Chrome &amp; Google Meet · Free forever for individuals</p>
            </div>
          </div>

          {/* Fact Block */}
          <div className="factblock" id="how">
            <h2>Effortless notes, in both your languages.</h2>
            <div className="factlist">
              <div className="lines"></div>
              <p className="fact">
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="4" y="5" width="16" height="12" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </span>
                <span>
                  Listens to your browser tab, <b>so it never joins the call</b>
                </span>
              </p>
              <p className="fact">
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                </span>
                <span>
                  <b>Private by default</b>, isolated per workspace, yours to delete
                </span>
              </p>
              <p className="fact">
                <span className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </span>
                <span>
                  Spells <b>Supabase</b>, <b>Razorpay</b> and <b>Figma</b> right — every time
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Pinned Stage */}
        <div className="rail">
          <div className="railpin">
            <div className="stage">
              <div className="poster p1" style={{ transform: `translate3d(0, ${p1Y}px, 0)` }}></div>
              <div className="poster p2" style={{ transform: `translate3d(0, ${p2Y}px, 0)` }}></div>
              <div className="poster p3" style={{ transform: `translate3d(0, ${p3Y}px, 0)` }}></div>

              <div className="pad">
                <div className="padbar">
                  <i style={{ background: "#ff736a" }}></i>
                  <i style={{ background: "#febc2e" }}></i>
                  <i style={{ background: "#19c332" }}></i>
                </div>

                <div className="padbody">
                  <div className="padttl">Sprint sync</div>
                  <div className="padmeta">
                    <span className="padchip">Today</span>
                    <span className="padchip">3 people</span>
                  </div>

                  <div className="padnotes">
                    <div className="layer">
                      <div className="raw" id="raw" style={{ opacity: rawOpacity }}>
                        <p>supabase migration — test?</p>
                        <p>razorpay webhook timing out</p>
                        <p>settings designs → review</p>
                        <p>anand: retry window</p>
                      </div>
                    </div>

                    <div className="layer">
                      <div
                        className="enh"
                        id="enh"
                        style={{ clipPath: `inset(0 0 ${clipInset.toFixed(1)}% 0)` }}
                      >
                        <p className="h">Migration</p>
                        <p className="b">
                          • <span className="tag">Supabase migration</span> script written, not yet tested
                        </p>
                        <p className="s">– Runs against staging before standup</p>
                        <p className="s">– Moved ahead of the vocabulary manager</p>

                        <p className="h">Payments risk</p>
                        <p className="b">
                          • <span className="tag">Razorpay</span> webhook timing out in sandbox
                        </p>
                        <p className="s">– Blocks the dashboard release</p>
                        <p className="s">– Ship only if resolved by 4pm</p>

                        <p className="h">Design</p>
                        <p className="b">• Settings page designs complete</p>
                        <p className="s">– Into review today</p>

                        <p className="h">Follow-ups</p>
                        <p className="s">– Anand: longer retry window</p>
                        <p className="s">– Sarhan: migration against staging</p>
                        <p className="s">– Devika: designs into review</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="padfoot">
                  <div className={`chip ${c1On ? "on" : ""}`} id="c1">
                    <span className="bars">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                    Transcribing
                  </div>
                  <div className={`chip ${c2On ? "on" : ""}`} id="c2">
                    <span className="spin"></span>Writing notes
                  </div>
                  <div className={`toggle ${tgOn ? "on" : ""} ${tgSlid ? "slid" : ""}`} id="tg">
                    <span className="knob"></span>
                    <span>Raw</span>
                    <span>Clean</span>
                  </div>
                </div>
              </div>

              <div className="vcall" style={{ transform: `translate3d(0, ${vcallY}px, 0)` }}>
                <div className="tile"></div>
                <div className="tile"></div>
                <div className="ctrls">
                  <i></i>
                  <i></i>
                  <i className="red"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
