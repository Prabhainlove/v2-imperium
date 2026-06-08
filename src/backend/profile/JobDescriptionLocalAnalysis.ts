/**
 * JD Analysis Engine — single source of truth for job description parsing.
 * Client-safe, deterministic, no LLM required. Reused by:
 *   - Resume generator + optimizer
 *   - Cover letter generator
 *   - Profile / LinkedIn analyzer
 */

export interface JDAnalysis {
  primaryRole: string;
  confidence: number; // 0..1
  primaryKeywords: string[];
  secondaryKeywords: string[];
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
}

export interface JobDescriptionInput {
  title?: string;
  company?: string;
  description?: string;
  tech_stack?: string[];
}

/* ───────── Role cluster scoring ───────── */

interface RoleCluster {
  name: string;
  weights: Record<string, number>;
}

const CLUSTERS: RoleCluster[] = [
  {
    name: "AI Engineer",
    weights: { ai: 3, llm: 3, "gen ai": 3, rag: 3, embeddings: 2, langchain: 2, agent: 2, "openai": 2, "prompt": 2, nlp: 2 },
  },
  {
    name: "ML Engineer",
    weights: { "machine learning": 3, ml: 2, pytorch: 3, tensorflow: 3, "scikit-learn": 2, model: 2, training: 2, mlops: 3, sagemaker: 2 },
  },
  {
    name: "Data Scientist",
    weights: { "data scientist": 4, statistics: 2, pandas: 2, numpy: 2, jupyter: 2, "a/b": 2, hypothesis: 2, "data science": 3 },
  },
  {
    name: "Data Analyst",
    weights: { "data analyst": 4, sql: 2, tableau: 3, "power bi": 3, excel: 2, dashboard: 2, reporting: 2, analytics: 2 },
  },
  {
    name: "Frontend Engineer",
    weights: { frontend: 3, react: 2, vue: 2, angular: 2, svelte: 2, "next.js": 2, css: 1, tailwind: 1, ui: 1, ux: 1, typescript: 1 },
  },
  {
    name: "Backend Engineer",
    weights: { backend: 3, api: 2, node: 2, express: 2, django: 2, flask: 2, fastapi: 2, spring: 2, microservice: 2, grpc: 2, "rest": 1 },
  },
  {
    name: "Full Stack Developer",
    weights: { "full stack": 4, fullstack: 4, "end-to-end": 1, react: 1, node: 1, "next.js": 1, frontend: 1, backend: 1 },
  },
  {
    name: "Cloud Engineer",
    weights: { cloud: 2, aws: 3, gcp: 3, azure: 3, terraform: 2, cloudformation: 2, lambda: 2, ec2: 2, s3: 1 },
  },
  {
    name: "DevOps Engineer",
    weights: { devops: 4, "ci/cd": 3, kubernetes: 3, docker: 2, jenkins: 2, ansible: 2, prometheus: 2, grafana: 2, sre: 3 },
  },
  {
    name: "QA Engineer",
    weights: { qa: 3, "quality assurance": 3, testing: 2, selenium: 3, cypress: 3, playwright: 3, jest: 1, automation: 2, "test cases": 2 },
  },
  {
    name: "Security Engineer",
    weights: { security: 3, "cyber security": 3, infosec: 3, pentest: 3, owasp: 3, "vulnerability": 2, encryption: 2, iam: 2 },
  },
  {
    name: "Mobile Engineer",
    weights: { mobile: 2, android: 3, ios: 3, swift: 3, kotlin: 3, "react native": 3, flutter: 3 },
  },
  {
    name: "Product Analyst",
    weights: { product: 2, "product analyst": 4, metrics: 2, funnel: 2, retention: 2, growth: 2, segmentation: 2 },
  },
  {
    name: "Business Analyst",
    weights: { "business analyst": 4, requirements: 2, stakeholder: 2, process: 2, "use case": 2, brd: 2 },
  },
  {
    name: "Software Engineer",
    weights: { "software engineer": 3, "software developer": 3, sde: 3, programming: 1, oop: 1, algorithms: 1 },
  },
];

function lower(s: string): string {
  return (s ?? "").toLowerCase();
}

function combinedText(job: JobDescriptionInput): string {
  return lower([job.title, job.description, (job.tech_stack ?? []).join(" ")].filter(Boolean).join(" \n "));
}

function scoreCluster(text: string, cluster: RoleCluster): number {
  let score = 0;
  for (const [term, weight] of Object.entries(cluster.weights)) {
    if (text.includes(term)) score += weight;
  }
  return score;
}

/* ───────── Skill extraction ───────── */

const TECH_VOCAB = [
  // languages
  "python","javascript","typescript","java","go","golang","rust","c++","c#","kotlin","swift","ruby","php","scala","r",
  // frontend
  "react","react.js","next.js","vue","angular","svelte","tailwind","html","css","redux","zustand","webpack","vite",
  // backend
  "node","node.js","express","fastapi","django","flask","spring","spring boot","nest","nest.js","rails","laravel","graphql","grpc","rest","rest api","rest apis",
  // databases
  "postgres","postgresql","mysql","mongodb","redis","sqlite","dynamodb","snowflake","bigquery","clickhouse","cassandra","elasticsearch",
  // cloud / devops
  "aws","gcp","azure","cloudflare","vercel","docker","kubernetes","k8s","terraform","ansible","jenkins","github actions","gitlab ci","circleci","ci/cd","prometheus","grafana","datadog",
  // ai/ml
  "pytorch","tensorflow","keras","scikit-learn","pandas","numpy","langchain","llamaindex","huggingface","openai","gemini","rag","llm","embeddings","vector db","pinecone","chromadb","fine-tuning",
  // tools
  "git","github","jira","figma","postman","linux","bash","selenium","cypress","playwright","jest","vitest","pytest","junit",
  // concepts
  "microservices","oop","system design","data structures","algorithms","agile","scrum",
];

function extractSkillsFromText(text: string): string[] {
  const t = ` ${text} `;
  const hits: string[] = [];
  for (const term of TECH_VOCAB) {
    const re = new RegExp(`(^|[^a-z0-9+#.])${term.replace(/[.+*?^$()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`, "i");
    if (re.test(t)) hits.push(term);
  }
  return Array.from(new Set(hits));
}

/* ───────── Requirements vs preferred ───────── */

const REQ_HEADERS = /(?:^|\n)\s*(?:requirements?|must[- ]have|qualifications?|what you'?ll need|what we'?re looking for|skills required|required skills?)\s*[:\-—]?\s*\n/i;
const PREF_HEADERS = /(?:^|\n)\s*(?:nice[- ]to[- ]have|preferred|bonus|plus|good to have|preferred qualifications?)\s*[:\-—]?\s*\n/i;
const NEXT_HEADER = /\n\s*(?:[A-Z][A-Za-z ]{2,40})\s*[:\-—]?\s*\n/;

function sliceSection(text: string, start: RegExp): string {
  const m = text.match(start);
  if (!m || m.index === undefined) return "";
  const after = text.slice(m.index + m[0].length);
  const end = after.match(NEXT_HEADER);
  return end && end.index !== undefined ? after.slice(0, end.index) : after.slice(0, 1200);
}

function bullets(section: string): string[] {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•·●▪]\s*/, "").trim())
    .filter((l) => l.length > 4 && l.length < 240)
    .slice(0, 20);
}

/* ───────── Keywords ───────── */

const STOPWORDS = new Set("a,an,the,and,or,for,of,in,on,to,with,by,at,as,is,are,was,were,be,been,being,from,that,this,it,its,into,you,your,we,our,i,me,my,but,not,if,so,do,did,have,has,had,will,can,could,should,would,may,might,must,more,less,than,then,about,across,after,against,all,also,any,because,before,both,each,few,how,just,off,only,other,over,own,same,some,such,under,up,using,what,when,where,which,who,why".split(","));

function keywordsFromText(text: string, max: number): string[] {
  const tokens = lower(text)
    .replace(/[^a-z0-9+#./\- ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 24 && !STOPWORDS.has(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k);
}

/* ───────── Public API ───────── */

export function analyzeJobDescription(job: JobDescriptionInput): JDAnalysis {
  const text = combinedText(job);
  const desc = job.description ?? "";

  // Role classification
  const scored = CLUSTERS.map((c) => ({ name: c.name, score: scoreCluster(text, c) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const totalScore = scored.reduce((acc, s) => acc + s.score, 0) || 1;
  const primaryRole = top && top.score > 0 ? top.name : (job.title?.trim() || "Software Engineer");
  const confidence = top && top.score > 0 ? Math.min(1, top.score / totalScore + 0.1) : 0.3;

  // Sections
  const requiredSection = sliceSection(desc, REQ_HEADERS);
  const preferredSection = sliceSection(desc, PREF_HEADERS);

  // Skills
  const baseSkills = extractSkillsFromText(text);
  const stackSkills = (job.tech_stack ?? []).map((s) => s.trim()).filter(Boolean);
  const requiredSkills = Array.from(new Set([
    ...stackSkills,
    ...extractSkillsFromText(requiredSection),
  ])).slice(0, 25);
  const preferredSkills = Array.from(new Set(
    extractSkillsFromText(preferredSection).filter((s) => !requiredSkills.includes(s)),
  )).slice(0, 15);

  // Keywords
  const allKeywords = keywordsFromText(text, 30);
  const primaryKeywords = Array.from(new Set([
    ...requiredSkills,
    ...allKeywords.filter((k) => baseSkills.includes(k)),
  ])).slice(0, 18);
  const secondaryKeywords = allKeywords.filter((k) => !primaryKeywords.includes(k)).slice(0, 18);

  const responsibilities = bullets(desc).filter((b) => /\b(build|design|implement|develop|create|own|lead|deliver|collaborat|maintain|optimi|deploy|architect|work with|partner|drive)/i.test(b)).slice(0, 8);

  return {
    primaryRole,
    confidence: Number(confidence.toFixed(2)),
    primaryKeywords,
    secondaryKeywords,
    responsibilities,
    requiredSkills,
    preferredSkills,
  };
}

/** Tech aliases for fuzzy matching profile skills vs JD skills. */
export const TECH_ALIASES: Record<string, string[]> = {
  react: ["reactjs", "react.js"],
  "react.js": ["react", "reactjs"],
  node: ["nodejs", "node.js"],
  "node.js": ["node", "nodejs"],
  postgres: ["postgresql"],
  postgresql: ["postgres"],
  javascript: ["js"],
  typescript: ["ts"],
  "next.js": ["nextjs", "next"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  "ci/cd": ["cicd", "continuous integration", "continuous deployment"],
  ml: ["machine learning"],
  "machine learning": ["ml"],
  ai: ["artificial intelligence"],
  llm: ["large language model", "large language models"],
};

export function normalizeSkillToken(value: string): string {
  return value.toLowerCase().replace(/\.js\b/g, "").replace(/[^a-z0-9+#]+/g, " ").trim();
}

export function skillMatches(skill: string, text: string): boolean {
  const s = normalizeSkillToken(skill);
  if (!s) return false;
  const t = normalizeSkillToken(text);
  if (t.includes(s)) return true;
  for (const alias of TECH_ALIASES[s.toLowerCase()] ?? []) {
    if (t.includes(normalizeSkillToken(alias))) return true;
  }
  return false;
}
