export interface ProgramReport {
  _id: string;
  _name: string;
  _created: number;
  _updated: number;
  _sent?: { at: number; via?: string; to?: string } | null;
  _profile?: Profile;
  deptLine1: string;
  deptLine2: string;
  deptLine3: string;
  reportTitle: string;
  progName: string;
  progField: string;
  execOrg: string;
  supportOrg: string;
  progDate: string;
  progFrom: string;
  progTo: string;
  progDur: string;
  progCal: 'h' | 'g';
  progStage: string;
  progMode: string;
  progTime: string;
  progGender: string;
  targetGroup: string;
  beneficiaryCount: string;
  giftedCount: string;
  goalsText: string;
  impactText: string;
  evidenceLink: string;
  dataLink: string;
  evLayout: '1' | '2' | 'ev+data';
  ev1Type: 'link' | 'image';
  ev1Label: string;
  ev2Type: 'link' | 'image';
  ev2Link: string;
  ev2Label: string;
  websiteText: string;
  customLogo?: string;
}

export interface ProgramItem {
  _open?: boolean;
  _src?: string;
  name: string;
  field: string;
  mode: string;
  time: string;
  stage: string;
  gender: string;
  ben: string;
  gifted: string;
  date: string;
  dur: string;
  cal?: 'h' | 'g';
}

export interface InitItem {
  _open?: boolean;
  org: string;
  goal: string;
}

export interface StudentItem {
  _open?: boolean;
  name: string;
  id: string;
  prog: string;
}

export interface MonthlyReport {
  _id: string;
  _name: string;
  _created: number;
  _updated: number;
  _sent?: { at: number; via?: string; to?: string } | null;
  _profile?: Profile;
  h_no: string;
  h_date: string;
  h_cal?: 'h' | 'g';
  h_att: string;
  month: string;
  semester: string;
  from: string;
  to: string;
  cal?: 'h' | 'g';
  programs: ProgramItem[];
  ind: string[];
  sst: string[];
  spr: string[];
  inits: InitItem[];
  evMode: string[];
  evLinks: string[];
  evSrc: (null | { rid: string; n: number })[];
  hiddenTables?: Record<string, boolean>;
  tableModes?: Record<string, 'manual' | 'migrated'>;
}

export interface FinalReport {
  _id: string;
  _name: string;
  _created: number;
  _updated: number;
  _sent?: { at: number; via?: string; to?: string } | null;
  _profile?: Profile;
  h_no: string;
  h_date: string;
  h_cal?: 'h' | 'g';
  h_att: string;
  cal?: 'h' | 'g';
  year?: string;
  programs: ProgramItem[];
  ind: string[];
  students: StudentItem[];
  sst: string[];
  spr: string[];
  inits: InitItem[];
  nsP: string[];
  nsQ: string[];
  evMode: string[];
  evLinks: string[];
  evSrc: (null | { rid: string; n: number })[];
  hiddenTables?: Record<string, boolean>;
  tableModes?: Record<string, 'manual' | 'migrated'>;
  customCharts?: Record<number, CustomChartConfig>;
}

export interface CustomChartConfig {
  mode?: 'auto' | 'manual';
  hidden?: boolean;
  showTable?: boolean;
  labels?: string[];
  series?: { name: string; values: (string | number)[]; color?: string }[];
  cnt?: string;
}

export interface StatsReport {
  [key: string]: any;
  _id: string;
  _name: string;
  _created: number;
  _updated: number;
  _sent?: { at: number; via?: string; to?: string } | null;
  _profile?: Profile;
  region: string;
  q1: string;
  q2: string;
  q4: string;
  q5: string;
  q6: string;
  q7: string;
  q8: string;
  q9: string;
  q10: string;
  q11: string;
  g2: string[];
  q15: string;
  q16: string;
  q17: string;
  q18: string;
  q19: string;
  g3: string[];
  g4: string[];
}

export interface Profile {
  center: string;
  dirM: string;
  dirF: string;
  followEmail?: string;
  logo?: string;
}
