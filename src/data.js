// ---------- Reference data (synthetic, for simulation) ----------
const VERSION='1.1.0';
const CPT={
'0120':{d:'Room & board – semi-private (per day)',r:900,cat:'IP',rev:1,day:1},'0114':{d:'Room & board – psychiatric (per day)',r:800,cat:'IP',rev:1,day:1},
'0200':{d:'Intensive care unit (per day)',r:2600,cat:'IP',rev:1},'0250':{d:'Pharmacy',r:450,cat:'IP',rev:1},'0270':{d:'Medical/surgical supplies',r:500,cat:'IP',rev:1},
'0278':{d:'Implants',r:2600,cat:'IP',rev:1},'0300':{d:'Laboratory',r:220,cat:'IP',rev:1},'0320':{d:'Radiology – diagnostic',r:260,cat:'IP',rev:1},
'0360':{d:'Operating room services',r:2100,cat:'IP',rev:1},'0370':{d:'Anesthesia',r:600,cat:'IP',rev:1},'0420':{d:'Physical therapy',r:150,cat:'IP',rev:1},
'0450':{d:'Emergency room',r:700,cat:'IP',rev:1},'0481':{d:'Cardiac catheterization lab',r:2800,cat:'IP',rev:1},'0720':{d:'Labor & delivery room',r:1400,cat:'IP',rev:1},
'99202':{d:'Office visit, new pt, straightforward',r:72,cat:'EM'},
'99203':{d:'Office visit, new pt, low MDM',r:110,cat:'EM'},
'99204':{d:'Office visit, new pt, moderate MDM',r:165,cat:'EM'},
'99212':{d:'Office visit, est pt, straightforward',r:57,cat:'EM'},
'99213':{d:'Office visit, est pt, low MDM',r:92,cat:'EM'},
'99214':{d:'Office visit, est pt, moderate MDM',r:131,cat:'EM'},
'99215':{d:'Office visit, est pt, high MDM',r:185,cat:'EM'},
'99283':{d:'ED visit, moderate',r:118,cat:'ER'},
'99284':{d:'ED visit, mod-high',r:200,cat:'ER'},
'99285':{d:'ED visit, high severity',r:290,cat:'ER'},
'99395':{d:'Preventive visit, est, 18-39',r:118,cat:'PREV'},
'99396':{d:'Preventive visit, est, 40-64',r:128,cat:'PREV'},
'G0439':{d:'Medicare annual wellness visit',r:130,cat:'PREV',medicare:1},
'93000':{d:'ECG, 12-lead w/ interp',r:17,cat:'DX'},
'36415':{d:'Routine venipuncture',r:3,cat:'LAB'},
'80053':{d:'Comprehensive metabolic panel',r:11,cat:'LAB'},
'83036':{d:'Hemoglobin A1c',r:10,cat:'LAB'},
'85025':{d:'CBC w/ auto diff',r:8,cat:'LAB'},
'71046':{d:'Chest X-ray, 2 views',r:32,cat:'IMG'},
'73721':{d:'MRI knee w/o contrast',r:230,cat:'IMG',pa:1},
'72148':{d:'MRI lumbar spine w/o contrast',r:225,cat:'IMG',pa:1},
'70553':{d:'MRI brain w/o & w/ contrast',r:360,cat:'IMG',pa:1},
'74177':{d:'CT abdomen/pelvis w/ contrast',r:310,cat:'IMG',pa:1},
'20610':{d:'Arthrocentesis/injection, major joint',r:62,cat:'PROC',mue:2},
'J1030':{d:'Methylprednisolone 40 mg inj',r:5,cat:'DRUG',mue:3},
'29881':{d:'Knee arthroscopy w/ meniscectomy',r:560,cat:'SURG',pa:1},
'27447':{d:'Total knee arthroplasty',r:1480,cat:'SURG',pa:1},
'45378':{d:'Colonoscopy, diagnostic',r:350,cat:'SURG'},
'45380':{d:'Colonoscopy w/ biopsy',r:410,cat:'SURG'},
'43235':{d:'Upper GI endoscopy, diagnostic',r:300,cat:'SURG'},
'43239':{d:'Upper GI endoscopy w/ biopsy',r:330,cat:'SURG'},
'97110':{d:'Therapeutic exercise, 15 min',r:30,cat:'PT',mue:4},
'97140':{d:'Manual therapy, 15 min',r:28,cat:'PT',mue:4},
'90834':{d:'Psychotherapy, 45 min',r:105,cat:'BH'},
'90837':{d:'Psychotherapy, 60 min',r:150,cat:'BH'},
'J0135':{d:'Adalimumab 20 mg inj (specialty)',r:1180,cat:'DRUG',pa:1,mue:4},
'J3301':{d:'Triamcinolone 10 mg inj',r:2,cat:'DRUG',mue:8}
};
const ICD={
'Z00.00':'General adult exam w/o abnormal findings','Z12.11':'Screening for malignant neoplasm of colon','E11.9':'Type 2 diabetes w/o complications',
'E11.65':'Type 2 diabetes w/ hyperglycemia','I10':'Essential hypertension','E78.5':'Hyperlipidemia, unspecified','J06.9':'Acute upper respiratory infection',
'J18.9':'Pneumonia, unspecified','A41.9':'Sepsis, unspecified organism','I50.23':'Acute on chronic systolic heart failure','K52.9':'Noninfective gastroenteritis and colitis','O80':'Encounter for full-term uncomplicated delivery','F33.2':'Major depressive disorder, recurrent, severe','I21.4':'Non-ST elevation myocardial infarction (NSTEMI)','M16.11':'Primary osteoarthritis, right hip','J44.1':'COPD with acute exacerbation','R07.9':'Chest pain, unspecified','R10.9':'Unspecified abdominal pain','M54.50':'Low back pain, unspecified',
'M51.26':'Intervertebral disc displacement, lumbar','M17.11':'Primary osteoarthritis, right knee','M17.12':'Primary osteoarthritis, left knee',
'S83.241A':'Medial meniscus tear, right knee, initial','M25.561':'Pain in right knee','R51.9':'Headache, unspecified','G43.909':'Migraine, unspecified',
'K21.9':'GERD without esophagitis','K92.1':'Melena','F41.1':'Generalized anxiety disorder','F32.1':'Major depressive disorder, moderate',
'M05.79':'Rheumatoid arthritis w/ RF, multiple sites','L40.50':'Arthropathic psoriasis','N40.0':'Benign prostatic hyperplasia (male)',
'O09.90':'Supervision of high-risk pregnancy (female)','S93.401A':'Sprain of right ankle, initial'
};
const SEXDX={'N40.0':'M','O09.90':'F','O80':'F'};
// medical-necessity: CPT -> allowed ICD prefixes
const MEDNEC={'73721':['M17','S83','M25.56'],'72148':['M54','M51'],'70553':['R51','G43'],'74177':['R10','K92'],'29881':['S83','M17'],
'27447':['M17'],'45380':['Z12','K92','R10'],'45378':['Z12','K92','R10'],'43239':['K21','K92','R10'],'43235':['K21','K92','R10'],'J0135':['M05','L40'],
'20610':['M17','M25','M05'],'97110':['M54','M51','M17','S93','M25','S83'],'97140':['M54','M51','M17','S93','M25','S83'],'90834':['F'],'90837':['F']};
// NCCI-style PTP edits: [column1, column2, modifierAllowed]
const NCCI=[['45380','45378',0],['43239','43235',0],['29881','20610',1],['99214','99396',1],['80053','85025',2]];
const CARC={
'1':['Deductible amount','Applied to your deductible'],'2':['Coinsurance amount','Your share of the cost (coinsurance)'],'3':['Co-payment amount','Your copay'],
'4':['Procedure code inconsistent with modifier / missing modifier','The billing code was missing a required modifier'],
'7':['Procedure inconsistent with patient sex','Service doesn\'t match patient sex on file'],
'10':['Diagnosis inconsistent with patient gender','Diagnosis doesn\'t match patient sex on file'],
'150':['Payer deems the information submitted does not support this level of service','The records didn\'t support how serious the hospital stay was billed as'],
'16':['Claim lacks information needed for adjudication','More information is needed from your provider'],
'18':['Exact duplicate claim/service','This bill was already received'],
'22':['May be covered by another payer per COB','Another insurance may need to pay first'],
'23':['Impact of prior payer adjudication','Adjusted for what your other insurance paid'],
'27':['Expenses incurred after coverage terminated','You weren\'t covered on this date'],
'29':['Time limit for filing has expired','Provider filed too late — you are not responsible'],
'45':['Charge exceeds fee schedule / contracted rate','Network discount — you don\'t owe this'],
'50':['Non-covered: not deemed medically necessary','Plan found it wasn\'t medically necessary'],
'96':['Non-covered charge','Not covered by your plan'],
'97':['Payment included in allowance for another service','Paid as part of another service'],
'151':['Units exceed payer frequency/MUE limit','More units billed than allowed'],
'197':['Precertification/authorization absent','Required pre-approval wasn\'t on file'],
'204':['Service not covered under current benefit plan','Not a benefit of your plan'],
'242':['Services not provided by network/primary care providers','Out-of-network provider not covered by your plan'],
'B13':['Previously paid','Already paid on an earlier claim']
};
const PLANS={
'PPO':{ipF:1.8,n:'UHC Choice Plus PPO',ded:1500,oop:6000,coins:.2,copay:{EM:30,ER:300,BH:30},oon:{ded:3000,coins:.4,mult:1.4},tf:90},
'HMO':{ipF:1.6,n:'UHC Navigate HMO',ded:500,oop:4500,coins:.1,copay:{EM:20,ER:250,BH:20,IP:250},oon:null,tf:90},
'HDHP':{ipF:1.8,n:'UHC Choice Plus HSA (HDHP)',ded:3200,oop:7000,coins:.1,copay:{},oon:{ded:6400,coins:.3,mult:1.4},tf:90},
'MA':{ipF:1.0,n:'AARP Medicare Advantage HMO-POS',ded:0,oop:3900,coins:.2,copay:{EM:10,ER:90,BH:10,IP:350},oon:{ded:0,coins:.4,mult:1.0},tf:365,medicare:1},
'EPO':{ipF:1.5,n:'Optum Care Network (delegated, 87726)',ded:750,oop:5000,coins:.15,copay:{EM:25,ER:250,BH:25},oon:null,tf:90,delegated:1}
};
const SPEC={HOSP:'Acute-care hospital (837I)',FM:'Family Medicine',IM:'Internal Medicine',ORTH:'Orthopedics',GI:'Gastroenterology',RAD:'Radiology',ED:'Emergency Medicine',PT:'Physical Therapy',BH:'Behavioral Health',RHEUM:'Rheumatology',NEURO:'Neurology',CARD:'Cardiology'};
const PROVSEED=[
['Allina Health Clinic – Uptown','FM','IN',1.00,'11'],['Maple Grove Internal Medicine','IM','IN',1.05,'11'],['Twin Cities Orthopedics','ORTH','IN',1.15,'11'],
['Minnesota GI Associates','GI','IN',1.10,'24'],['Center for Diagnostic Imaging','RAD','IN',1.08,'22'],['Abbott Northwestern ED Physicians','ED','IN',1.20,'23'],
['Core Motion Physical Therapy','PT','IN',0.95,'11'],['Lakeside Behavioral Health','BH','IN',1.00,'11'],['North Star Rheumatology','RHEUM','IN',1.10,'11'],
['Summit Neurology Partners','NEURO','IN',1.12,'11'],['Midwest Heart & Vascular','CARD','IN',1.10,'11'],['Optum Care – Edina','FM','IN',1.00,'11'],
['Prestige Concierge Medicine','IM','OON',1.00,'11'],['Elite Spine & Pain Institute','ORTH','OON',1.00,'11'],['QuickCare Wellness LLC','FM','IN',1.00,'11',1],
['Riverbend Family Practice (termed)','FM','TERM',1.00,'11'],
['Abbott Northwestern Hospital','HOSP','IN',1.00,'21'],['Mercy Hospital – Coon Rapids','HOSP','IN',0.95,'21'],['Lakeview Regional Medical Center','HOSP','OON',1.00,'21']
];
const SCEN={ // specialty -> encounter templates [weight, lines[[cpt,units,mods]], dx[]]
FM:[[5,[['99213'],['36415'],['83036']],['E11.9','I10']],[4,[['99214'],['80053'],['36415']],['E11.65','E78.5']],[3,[['99395']],['Z00.00']],[2,[['99396'],['85025'],['36415']],['Z00.00']],[3,[['99213']],['J06.9']],[1,[['99203']],['R51.9']]],
IM:[[4,[['99214'],['93000']],['I10','R07.9']],[3,[['99213'],['80053'],['36415']],['E78.5','I10']],[1,[['G0439']],['Z00.00']],[2,[['99215']],['E11.65','I10']]],
ORTH:[[3,[['99214'],['20610'],['J1030']],['M17.11']],[2,[['29881']],['S83.241A']],[1,[['27447']],['M17.12']],[2,[['99203'],['73721']],['M25.561']],[2,[['99213']],['S93.401A']]],
GI:[[3,[['45378']],['Z12.11']],[2,[['45380']],['Z12.11']],[2,[['43239']],['K21.9']],[1,[['99204']],['R10.9']]],
RAD:[[3,[['72148']],['M54.50']],[2,[['73721']],['M17.11']],[2,[['70553']],['G43.909']],[2,[['74177']],['R10.9']],[3,[['71046']],['J18.9']]],
ED:[[3,[['99284'],['71046']],['J18.9']],[2,[['99285'],['93000'],['71046']],['R07.9']],[3,[['99283']],['S93.401A']]],
PT:[[5,[['97110',3],['97140',2]],['M54.50']],[3,[['97110',2],['97140',2]],['M17.11']]],
BH:[[5,[['90834']],['F41.1']],[4,[['90837']],['F32.1']]],
RHEUM:[[3,[['99214'],['J0135',2]],['M05.79']],[2,[['99213'],['85025']],['L40.50']]],
NEURO:[[3,[['99204']],['G43.909']],[2,[['99214'],['70553']],['R51.9']]],
CARD:[[4,[['99214'],['93000']],['I10']],[2,[['99215'],['93000']],['R07.9']]],
HOSP:[[3,[['0120'],['0250'],['0300'],['0320']],['J18.9'],'194'],[1,[['0120'],['0200',2],['0250'],['0300']],['J18.9','J44.1'],'193'],[2,[['0120'],['0200',2],['0250'],['0300'],['0450']],['A41.9','J18.9'],'871'],
 [2,[['0120'],['0250'],['0300'],['0320']],['I50.23','I10'],'291'],[2,[['0120'],['0360'],['0370'],['0278'],['0270'],['0420']],['M17.11'],'470'],[2,[['0120'],['0720'],['0250'],['0300']],['O80'],'807'],
 [1,[['0114'],['0250']],['F33.2'],'885'],[1,[['0120'],['0481'],['0278'],['0250']],['I21.4','I10'],'247'],[2,[['0120'],['0250'],['0300']],['K52.9'],'392'],[1,[['0120'],['0200'],['0250'],['0300']],['J44.1'],'190']]
};
const FIRST=['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Carlos','Maria','Wei','Aisha','Omar','Priya','Ethan','Olivia','Noah','Emma','Liam','Sofia','Hmong','Ingrid','Lars','Fatima','Diego','Grace'];
const LAST=['Johnson','Nguyen','Smith','Garcia','Olson','Anderson','Hansen','Lee','Patel','Martinez','Larson','Brown','Davis','Kim','Thao','Lopez','Miller','Wilson','Peterson','Ahmed','Clark','Lewis','Young','Walker','Hall','Allen'];
const PEOPLE=[['Providers / billing & revenue-cycle teams','Document, code and submit claims; work denials and appeals.'],['Clearinghouses','Scrub, batch and route EDI 837s; return 999/277CA acknowledgements.'],
['Payer intake & auto-adjudication systems','Validate, price and decide clean claims in seconds.'],['Claims examiners / adjudicators','Work pended claims: COB, missing info, high-dollar, edits.'],
['Clinical reviewers / medical directors','Medical-necessity and prior-auth determinations.'],['Payment integrity / SIU','Pre-pay review (OPRS), post-pay data mining, overpayment recovery, FWA.'],
['Appeals teams','Reconsiderations and appeals; overturn or uphold with rationale.'],['IT / data / rules configuration','Benefit config, fee schedules, edit libraries, rule changes.'],
['Compliance / regulatory','Timeliness (prompt-pay), CMS/state rules, audit trails.'],['Finance / accounting','EFT/check runs, 835 posting, recoveries and accruals.'],['Members','Receive EOBs, owe cost-share, may appeal.']];
const SYSTEMS=[['MS-DRG grouper & inpatient pricer','837I hospital stays are grouped to an MS-DRG; payment = hospital base rate × DRG relative weight (+ cost outlier). DRG validation audits that the principal diagnosis supports the DRG billed.'],['EDI gateway / clearinghouse','X12 837P/837I in; 999, 277CA, 277, 835 out.'],['Core claims engine + rules engine','Layered edits, pricing, decisioning (this app\'s pipeline).'],
['Eligibility & enrollment','Coverage spans, plan, accumulators (270/271).'],['Provider contract / fee-schedule DB','Network status, rates, multipliers.'],
['Medical policy / clinical decision support','Medical-necessity criteria, prior-auth (278).'],['Optum Claims Manager / OPRS','Code-edit library; prepayment review system.'],
['Optum Real','Real-time, point-of-care coverage + issue interception (shift-left).'],['Provider portal / APIs','UHC Provider Portal: submission, status, appeals.'],['Data warehouse / analytics','Integrity mining, reporting, KPIs.']];
const LIFECYCLE=[
['Claim generation & submission','Your doctor\'s office writes up the visit, turns it into billing codes and sends the bill.','Documentation → ICD-10 + CPT/HCPCS coding → scrubber → 837P/I via clearinghouse/API/portal. Timely filing (often 90 days) applies.','Submit tab · simulated stream'],
['Intake & initial validation','The insurer checks the bill is complete and readable.','Envelope/auth, X12 syntax, required fields, NPI check digit, member ID, dates; reject via 999/277CA.','Stage 1 · Intake'],
['Eligibility, benefits & provider','Were you covered that day, is the service a benefit, is the doctor in-network?','270/271 eligibility on DOS, benefit config, network/contract, prior auth (278), COB.','Stages 2–5'],
['Coding, medical necessity & rules','Do the codes make sense together and is the service justified?','Code validity, NCCI PTP bundling, MUE, sex/age edits, medical policy, duplicates, FWA scoring.','Stages 6–8'],
['Pricing & payment calculation','The contract price is applied and your share is calculated.','Fee schedule × contract multiplier, CO-45 contractual write-off, deductible/copay/coinsurance, OOP max, COB.','Stage 9 · Pricing'],
['Adjudication decision','Pay automatically, deny, or send to a person to review.','Auto-approve / auto-deny / pend to examiner, clinical, SIU, COB or high-dollar queues.','Stage 10 · Queue tab'],
['Payment, remittance & reporting','The doctor gets paid and you get an Explanation of Benefits.','835 ERA + EFT/check, EOB, 277 status, financial posting.','Claim drawer · EOB / 835 / 277'],
['Post-adjudication','Appeals, corrections and audits after the fact.','Reconsiderations/appeals, adjustments, overpayment recovery, post-pay mining.','Appeals & Integrity tabs']];

// MS-DRG (synthetic subset; weights approximate CMS FY tables). dx = principal-dx prefixes that group to the DRG
const DRG={
'470':{d:'Major hip & knee joint replacement w/o MCC',w:1.91,alos:2,dx:['M16','M17'],pa:1},
'193':{d:'Simple pneumonia & pleurisy w MCC',w:1.30,alos:4.5,dx:['J18']},
'194':{d:'Simple pneumonia & pleurisy w CC',w:0.89,alos:3.4,dx:['J18']},
'871':{d:'Septicemia w/o MV >96 hrs w MCC',w:1.93,alos:4.9,dx:['A41']},
'291':{d:'Heart failure & shock w MCC',w:1.34,alos:4.3,dx:['I50']},
'190':{d:'COPD w MCC',w:1.17,alos:3.9,dx:['J44']},
'392':{d:'Esophagitis, gastroent & misc digestive disorders w/o MCC',w:0.78,alos:2.8,dx:['K52','K21','R10']},
'807':{d:'Vaginal delivery w/o sterilization/D&C w/o CC/MCC',w:0.60,alos:2,dx:['O80']},
'885':{d:'Psychoses',w:1.33,alos:6.5,dx:['F32','F33']},
'247':{d:'Perc cardiovasc proc w drug-eluting stent w/o MCC',w:2.05,alos:2,dx:['I21']}
};
const UPC={'194':'871','291':'871','392':'871','190':'871'}; // classic sepsis upcoding targets
