/*
 * THE CONTENT FILE. Business facts, services, prices and copy used on more
 * than one page. Prices live only here (tests/site.test.ts pins them).
 *
 * Rules: no em dashes, no invented reviews, stats or client names. Leave a
 * field empty ("") rather than guess; pages hide anything that is empty.
 */
import type { Availability } from "./lib/schedule";

/** Wix-hosted images from the old site. Copy them into /public before the Wix plan ends. */
const wix = (id: string, w: number, h: number) =>
  `https://static.wixstatic.com/media/${id}/v1/fill/w_${w},h_${h},al_c,q_85,enc_auto/${id}`;

export const site = {
  name: "Resume Pro NC",
  tagline: "Resumes, LinkedIn profiles and cover letters, written by a real person.",
  owner: "Nancy Turner",
  firstName: "Nancy",
  url: "https://www.resumepronc.com",
  description:
    "Nancy Turner writes resumes, LinkedIn profiles and cover letters for entry-level to executive job seekers. Personally written, never outsourced. Free resume review.",

  email: "Nancy@ResumeProNC.com",
  phones: [
    { label: "Charlotte, NC", number: "704-998-1088" },
    { label: "Greenville, SC", number: "864-735-7123" },
  ],
  /** Shown on the order thank-you page as a Pay with PayPal button. Empty = Nancy emails an invoice. */
  paypalEmail: "nancy@resumepronc.com",
  googleReviewsUrl: "",
  /** Link clients use to leave Nancy a review (sent with the final files). Empty = the line is left out. */
  reviewRequestUrl: "https://www.google.com/maps/place//data=!4m3!3m2!1s0x8856bdc166854ff3:0xb222728c75ae2bd9!12e1?source=g.page.m.ia._&laa=nmx-review-solicitation-ia2",

  turnaround: "5 to 7 business days", // Confirmed by Blake 2026-11-20 (her old emails said 10 to 12 days).
  /** Business days from payment to first draft, for the due date on Nancy's dashboard. */
  draftDays: 7,
  revisionWindowDays: 30,

  // Hero banner from the old home page (job seeker celebrating at a desk).
  heroPhoto: wix("d45992_b10da7ac86e24885a753f59bc6e7b255~mv2.jpg", 2400, 1150),
  nancyPhoto: wix("13e2d0_5a17b775028849449f1869ed3741c4c9~mv2.jpg", 640, 800),
  dougPhoto: wix("d45992_de521611c8dc43b1baf747b14c20852e~mv2.jpg", 480, 600),
} as const;

export type Service = {
  id: string;
  name: string;
  price: number;
  /** Who it is for, one line. */
  fit: string;
  summary: string;
  kind: "resume" | "addon" | "coaching";
  note?: string;
};

export const services: Service[] = [
  {
    id: "entry",
    name: "Entry Level Resume",
    price: 295,
    kind: "resume",
    fit: "Less than 1 year of total work experience",
    summary:
      "Showcases your education, life experience, passion and potential, so employers can see you have what it takes to be a valued part of their team.",
  },
  {
    id: "professional",
    name: "Professional Resume",
    price: 395,
    kind: "resume",
    fit: "Over 1 year of experience, no management experience",
    summary:
      "For a promotion, a move, or a new career field. A powerful resume that highlights accomplishments, results and career progression to get you interviews.",
  },
  {
    id: "management",
    name: "Management Level Resume",
    price: 495,
    kind: "resume",
    fit: "Management, project management or supervisory experience",
    summary:
      "Shows your record of achievements, forward-thinking leadership, strategic planning, training, problem solving and documented results. Resumes that open doors so you can close the deal.",
  },
  {
    id: "linkedin",
    name: "LinkedIn Profile",
    price: 325,
    kind: "addon",
    fit: "Anyone who wants recruiters to find them",
    summary:
      "A credible online presence. LinkedIn is one of the first places employers look for qualified candidates, and a strong profile helps recruiters notice your skills.",
  },
  {
    id: "cover-letter",
    name: "Personalized Cover Letter",
    price: 55,
    kind: "addon",
    fit: "Added to a resume order",
    summary: "An attention-grabbing cover letter based on your unique background.",
    note: "With a resume order only",
  },
  {
    id: "coaching",
    name: "Interview Coaching",
    price: 150,
    kind: "coaching",
    fit: "Anyone with an interview coming up",
    summary:
      "A one-hour Zoom session with Doug Burtch, a retired Fortune 500 executive. You keep the recording to review before your interviews.",
    note: "One-hour session",
  },
];

export const freeOffers = [
  {
    name: "Free Resume Review",
    href: "/free-resume-review/",
    summary: "Send your current resume and get an honest, no-strings opinion on 8 points.",
  },
  {
    name: "Free Phone Consultation",
    href: "/contact/#call",
    summary: "A 30-minute call to talk through what you need before you order.",
  },
];

export const reviewCriteria = [
  "First impression",
  "Relevance",
  "Career goal",
  "Organization and format",
  "Content",
  "Accomplishments",
  "Writing style",
  "Grammar and punctuation",
];

// Nancy's real process, in order (Blake, 2026-11-20): talk first, then details, then payment, then writing.
export const steps = [
  { title: "Call or text me", body: "Reach out by phone, text or the contact form. I'll call you back to learn about your goals and recommend the right service." },
  { title: "Share your details", body: "Fill in the questionnaire, attach your current resume, and add links to the jobs you're applying for." },
  { title: "Pay to get on my schedule", body: "I send you a payment link. Once payment and your questionnaire are in, you're on my writing schedule." },
  { title: "Review your draft", body: `I email your first draft, usually within ${site.turnaround}. I revise until you're 100% happy.` },
  { title: "Get your final files", body: `You get a Word file for online applications and a PDF for email and print, plus ${site.revisionWindowDays} days of free revisions.` },
];

/** Real client quotes from the old site, as written. Add new ones only with permission. */
export const testimonials = [
  {
    quote:
      "I am amazed how Nancy transformed my resume! After not hearing back from applying to many jobs, I decided to use this resume service. I am so thankful I did because I just got the perfect job using my new resume! I highly recommend!",
    name: "S. Cooke",
  },
  {
    quote:
      "I can't thank Nancy enough for the professional resume she created for me. Her knowledge of formatting and use of key words has my applications moving to the front of the line. Before using Nancy's services, I was not getting any responses from potential employers. Now my resume is standing out because of her expertise. 5 out of 5 stars!",
    name: "J. G.",
  },
  {
    quote:
      "Wow am I grateful I turned to Resume Pro. They upgraded my resume, cover letter, and LinkedIn profile to a level I could have never imagined! Very thorough and represented my skills and experience in the most professional way possible.",
    name: "A. B.",
  },
  {
    quote:
      "My resume looks wonderful. I can't thank you enough for providing your expertise. I feel much more confident about getting a job with this critical step taken care of. I followed my gut in selecting you as I have read about scam resume services, and am happy with my decision and the final outcome.",
    name: "Rachel R.",
    place: "Puerto Rico",
  },
];

export const faqs = [
  {
    q: "Can you really make this easy? How does it work?",
    a: "Absolutely. My job is to make this process easy. Place your order, then fill in the questionnaire so I can get to know you, the position you want, your skills, experience, education and accomplishments. Attach your current resume if you have one. Don't worry about spelling, grammar or punctuation. Just give me the facts and dates and I'll handle the rest.",
  },
  {
    q: "Who will actually write my resume?",
    a: "I will. Every resume is personally written by me, never outsourced or automated. I take pride in personal service, quick responses and a lot of creative energy.",
  },
  {
    q: "How do we communicate?",
    a: "That's up to you. Some clients prefer to do everything online. Others want more personal attention and prefer phone calls. I'm flexible and will go with what works for you.",
  },
  {
    q: "What is the turnaround time?",
    a: `My typical turnaround is ${site.turnaround}. If you need it sooner, tell me when you order and I'll do my best to make it happen.`,
  },
  {
    q: "Do you have a guarantee?",
    a: `You bet. My job isn't finished until you're 100% satisfied with your resume, cover letter and LinkedIn profile. We go over your documents together and I revise until you're completely happy. After you approve them, you have ${site.revisionWindowDays} more days of revisions at no charge.`,
  },
  {
    q: "Do I really need a LinkedIn profile?",
    a: "Here's the deal: LinkedIn is a favorite hunting ground for recruiters and one of the first places employers look for candidates. The basic account is free. Having no profile, or a weak one, can hurt your chances of getting an interview.",
  },
  {
    q: "How and when do I pay?",
    a: site.paypalEmail
      ? "Right after you place your order, you can pay securely through PayPal with a credit card, debit card or your PayPal account. You don't need a PayPal account. Writing starts once payment is received."
      : "After you place your order, I email you an invoice you can pay by credit card, debit card or PayPal. Writing starts once payment is received.",
  },
];

// Free phone consultation hours (Eastern), from Nancy 2026-11-20: Mon-Thu 8 AM to 6 PM, Fri 8 AM to 5 PM.
export const availability: Availability = {
  timeZone: "America/New_York",
  callMinutes: 30,
  stepMinutes: 30,
  noticeHours: 18,
  daysAhead: 14,
  weekly: {
    1: [["08:00", "18:00"]],
    2: [["08:00", "18:00"]],
    3: [["08:00", "18:00"]],
    4: [["08:00", "18:00"]],
    5: [["08:00", "17:00"]],
  },
};

/** Sample resumes from the old gallery (each made for a real client, shown on the old site). */
export const samples = [
  "d45992_e28a6e27a04d4cf5a9203eb9d0922613~mv2_d_2550_3300_s_4_2.jpg",
  "d45992_aa74501b0cf34ed2916d64c218554514~mv2_d_2550_3300_s_4_2.jpg",
  "d45992_ded6f3bade4c48cfa8ebd58ec0e9549e~mv2_d_2550_3300_s_4_2.jpg",
  "d45992_4cc46a5adbbb4ef68540007449fbb29f~mv2_d_2550_3300_s_4_2.jpg",
].map((id, i) => ({
  thumb: wix(id, 510, 660),
  full: wix(id, 1275, 1650),
  alt: `Sample resume ${i + 1}`,
}));

export const nav = [
  { href: "/services/", label: "Services & Pricing" },
  { href: "/samples/", label: "Samples" },
  { href: "/about/", label: "About" },
  { href: "/faq/", label: "FAQ" },
  { href: "/career-tips/", label: "Career Tips" },
  { href: "/contact/", label: "Contact" },
];

export const blogCategories = ["Resume Tips", "Interview Tips", "Job Search", "Career Planning", "LinkedIn Profile Tips"] as const;
