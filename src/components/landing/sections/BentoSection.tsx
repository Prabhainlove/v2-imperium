import portrait from "@/assets/landing/bento_red_portrait.jpg";
import logo from "@/assets/landing/imperium_logo.png";

export default function BentoSection() {
  return (
    <section className="relative w-full bg-[#e8e4dd] py-24">
      <div className="mx-auto max-w-7xl px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-black/55">( Principles )</p>
        <h2 className="mt-3 font-sans text-[clamp(48px,9vw,140px)] font-medium leading-[0.92] tracking-[-0.04em] text-black">
          Principles
        </h2>
      </div>
      <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-3 px-4 md:grid-cols-6 md:grid-rows-3 md:gap-4 md:px-8">
        {/* Scroll smoothly */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:row-span-2">
          <div className="flex h-full flex-col items-center justify-between">
            <img src={logo} alt="" className="h-12 w-12 rounded-xl" />
            <div className="font-mono text-[11px] tracking-[0.3em] text-black/70" style={{ writingMode: "vertical-rl" }}>
              SCROLL SMOOTHLY
            </div>
            <div className="h-1 w-1 rounded-full bg-black/30" />
          </div>
        </div>

        {/* Performance supervision */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:row-span-2">
          <div className="font-sans text-[20px] font-medium leading-tight text-black">Performance<br />Supervision</div>
          <div className="mt-12 text-center font-serif text-[36px] text-black/80">フィドル</div>
        </div>

        {/* Portrait — large center */}
        <div className="relative col-span-2 row-span-2 overflow-hidden rounded-3xl ring-1 ring-black/5 md:col-span-2">
          <img src={portrait} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
          <div className="absolute inset-x-6 bottom-6 text-center">
            <h3 className="font-sans text-[22px] font-medium text-white">Control your Progress Data</h3>
            <p className="mt-2 text-[12px] leading-snug text-white/80">
              <span className="opacity-60">( </span>Break it apart, apply to any element across the page, pass it through JS.<span className="opacity-60"> )</span>
            </p>
          </div>
        </div>

        {/* Use scroll container */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:col-span-2">
          <h3 className="font-sans text-[20px] font-medium leading-tight text-black">Use any container.<br /><span className="text-black/40">Anywhere you want.</span></h3>
          <div className="mt-3 h-24 w-full overflow-hidden rounded-xl bg-[#0e0e10]">
            <div className="px-3 py-2 text-[10px] text-white/60">IMPERIUM©</div>
          </div>
        </div>

        {/* Safe kerning */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:col-span-2">
          <h3 className="font-sans text-[18px] font-medium leading-tight text-black">Safe natural kerning when Splitting</h3>
          <div className="mt-4 inline-block rounded-md border border-dashed border-[#ff5a3a]/60 px-3 py-2">
            <span className="font-sans text-[44px] font-medium text-[#ff5a3a]">Tu</span>
          </div>
        </div>

        {/* Progress easing */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:col-span-2">
          <svg viewBox="0 0 200 120" className="h-28 w-full">
            <defs>
              <pattern id="grid" width="33" height="20" patternUnits="userSpaceOnUse">
                <path d="M 33 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="200" height="120" fill="url(#grid)" />
            <path d="M 0 110 C 50 110, 80 10, 200 10" fill="none" stroke="#ff5a3a" strokeWidth="2" />
            <line x1="0" y1="120" x2="200" y2="0" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
          </svg>
          <p className="mt-3 text-center font-sans text-[16px] font-medium text-black">Progress Easing</p>
        </div>

        {/* Ultra optimized */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:col-span-3">
          <h3 className="font-sans text-[20px] font-medium text-black">Ultra Optimized</h3>
        </div>

        {/* Compose */}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/5 md:col-span-3">
          <h3 className="font-sans text-[20px] font-medium text-black">Compose, extend, ship.</h3>
        </div>
      </div>
    </section>
  );
}
