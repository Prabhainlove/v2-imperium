/** Inline SVG icon set for the dashboard. Keep flat, single-color, currentColor. */
import type { SVGProps } from "react";

type I = (p: SVGProps<SVGSVGElement>) => JSX.Element;

const wrap = (path: JSX.Element): I => (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {path}
  </svg>
);

export const IconStar: I = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2l2.9 6.9L22 10l-5.5 4.7L18 22l-6-3.6L6 22l1.5-7.3L2 10l7.1-1.1z" />
  </svg>
);

export const IconStarHalf: I = (p) => (
  <svg viewBox="0 0 24 24" {...p}>
    <defs><linearGradient id="halfStar"><stop offset="50%" stopColor="currentColor"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs>
    <path d="M12 2l2.9 6.9L22 10l-5.5 4.7L18 22l-6-3.6L6 22l1.5-7.3L2 10l7.1-1.1z" fill="url(#halfStar)" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const IconBriefcase: I = wrap(<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>);
export const IconDoc: I = wrap(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>);
export const IconUsers: I = wrap(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>);
export const IconHandshake: I = wrap(<><path d="M11 17l2 2a1 1 0 1 0 3-3"/><path d="M14 14l2.5 2.5a1 1 0 1 0 3-3L15 9"/><path d="M19.5 14.5L21 13a2 2 0 0 0 0-3l-7-7-3 3a4 4 0 0 1-2 1H7l-4 4 3 3 2-2h2l2 2"/></>);

export const IconGem: I = wrap(<><path d="M6 3l-3 6 9 12 9-12-3-6H6z"/><path d="M3 9h18M9 3l3 6 3-6"/></>);
export const IconCoin: I = wrap(<><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9h4.5a1.5 1.5 0 1 1 0 3H9h5a1.5 1.5 0 1 1 0 3H9"/></>);
export const IconGear: I = wrap(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.13.68.36.92.66.24.3.38.66.41 1.04"/></>);
export const IconPlus: I = wrap(<><path d="M12 5v14M5 12h14"/></>);
export const IconArrowRight: I = wrap(<><path d="M5 12h14M12 5l7 7-7 7"/></>);

/* Attributes */
export const IconStrength: I = wrap(<><path d="M6 14l3-3 3 3 3-3 3 3"/><path d="M3 18h18"/><circle cx="12" cy="6" r="3"/></>);
export const IconEnergy: I = wrap(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>);
export const IconVelocity: I = wrap(<><path d="M12 22a10 10 0 1 1 10-10"/><path d="M12 12l5-3"/></>);
export const IconFocus: I = wrap(<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>);
export const IconInfo: I = wrap(<><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>);

/* Powers */
export const IconMastery: I = wrap(<><path d="M4 19V6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2"/><path d="M9 8h6M9 12h6"/></>);
export const IconInterview: I = wrap(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>);
export const IconSpeed: I = wrap(<><path d="M3 18l4-8 4 5 4-9 6 14"/></>);

/* Activity */
export const IconResume: I = wrap(<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></>);
export const IconApplied: I = wrap(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>);
export const IconATS: I = wrap(<><path d="M9 12l2 2 4-4"/><path d="M21 12c0 5-3.5 7-9 7s-9-2-9-7V7l9-4 9 4z"/></>);

/* Inventory module icons */
export const IconCore: I = wrap(<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>);
export const IconChat: I = wrap(<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>);
export const IconCheck: I = wrap(<><polyline points="20 6 9 17 4 12"/></>);
export const IconBubble: I = wrap(<><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>);
export const IconHat: I = wrap(<><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></>);
export const IconSparkle: I = wrap(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></>);
export const IconScan: I = wrap(<><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></>);
export const IconNetwork: I = wrap(<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.5 7.5l3 8M16.5 7.5l-3 8"/></>);
export const IconChart: I = wrap(<><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="5" width="3" height="13"/></>);
export const IconShield: I = wrap(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polygon points="12 8 13 11 16 11 13.5 13 14.5 16 12 14 9.5 16 10.5 13 8 11 11 11" fill="currentColor" stroke="none"/></>);

/* Mail / map / id / cal */
export const IconMail: I = wrap(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>);
export const IconMap: I = wrap(<><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></>);
export const IconCal: I = wrap(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>);
export const IconId: I = wrap(<><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 10h4M14 14h4"/></>);
export const IconUser: I = wrap(<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>);

export const ICONS_INVENTORY = {
  job: IconBriefcase,
  resume: IconDoc,
  ats: IconCheck,
  tracker: IconChat,
  interview: IconBubble,
  skill: IconHat,
  assistant: IconSparkle,
  recruiter: IconScan,
  network: IconNetwork,
  salary: IconChart,
} as const;

export const ICONS_POWER = {
  mastery: IconMastery,
  interview: IconInterview,
  speed: IconSpeed,
} as const;

export const ICONS_ATTR = {
  strength: IconStrength,
  energy: IconEnergy,
  velocity: IconVelocity,
  focus: IconFocus,
} as const;

export const ICONS_ACTIVITY = {
  resume: IconResume,
  applied: IconApplied,
  interview: IconBubble,
  ats: IconATS,
} as const;
