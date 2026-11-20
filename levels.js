/* Breach Escape level list (Breach Map). Each playable level is a case file in levels/<id>.json,
   run by the case engine in case.js. Facts in each case come from the sources listed inside its JSON file. */
window.LEVELS = [
  { id: 1, name: 'The Forgotten Test Account', victim: 'Microsoft', year: 2024, teaser: 'A forgotten test account opens the door to executive email.', status: 'ready', case: 'levels/midnight-blizzard.json' },
  { id: 2, name: 'The Legacy VPN', victim: 'Colonial Pipeline', year: 2021, teaser: 'One legacy VPN profile, password only.', status: 'ready', case: 'levels/colonial-pipeline.json' },
  { id: 3, name: 'MFA Fatigue', victim: 'Uber', year: 2022, teaser: 'Push spam, then secrets in a script.', status: 'soon' },
  { id: 4, name: 'The Help Desk Call', victim: 'MGM Resorts', year: 2023, teaser: 'A phone call becomes admin access.', status: 'soon' },
  { id: 5, name: 'Stolen Passwords at Scale', victim: 'Snowflake customers', year: 2024, teaser: 'Infostealer logins, no MFA.', status: 'soon' },
  { id: 6, name: 'The Open Portal', victim: 'Change Healthcare', year: 2024, teaser: 'Remote access without MFA.', status: 'soon' },
  { id: 7, name: 'The Forged Key', victim: 'Microsoft (Storm-0558)', year: 2023, teaser: 'A stolen signing key forges tokens.', status: 'soon' }
];

/* Tap-to-define glossary, shared by every case. Plain language, one or two sentences. Draft: review before publishing. */
/* Site settings. contactEmail: shown on the About screen as the corrections contact when set (empty until provided). */
window.SITE = { contactEmail: '' };

/* SOC LEAD lines: shared defaults. A case can override any of them with a "voice" object in its JSON. */
window.VOICE = {
  patientZero: 'Good eye. That\u2019s the door they used.',
  wrong: 'Close, but that\u2019s noise. Check the timestamps.',
  hint: 'No shame in asking. Real analysts check the docs too.',
  run: 'Let\u2019s see if it holds.',
  breached: 'They got in. Now you know where. Rebuild.',
  prevented: 'Prevented. They never got in.',
  contained: 'Contained. That\u2019s the job.'
};

window.GLOSSARY = {
  'MFA': 'Multifactor authentication. A second proof besides the password, like an app prompt or a security key. A stolen password alone is not enough.',
  'Conditional Access': 'Entra ID policies that decide, at sign-in, who gets in and under what conditions, for example requiring MFA or a healthy device.',
  'Smart Lockout': 'Entra ID’s automatic lock after repeated wrong passwords on one account. Sprays stay under the threshold on purpose.',
  'legacy authentication': 'Old sign-in protocols (like basic auth for IMAP or SMTP) that cannot do MFA. Attackers love them; block them.',
  'Identity Protection': 'Entra ID feature that scores sign-ins and users for risk (leaked credentials, impossible travel) and can block or require MFA.',
  'OAuth app': 'An application registered in the directory that can be granted permissions to read or act on data, sometimes without any user signed in.',
  'application permissions': 'Permissions an app uses as itself, with no user present. Powerful, and invisible to user-focused controls like MFA.',
  'service principal': 'The identity an app has inside a tenant. It can hold roles and secrets just like a user account.',
  'service principals': 'The identities apps have inside a tenant. They can hold roles and secrets just like user accounts.',
  'app governance': 'A Defender for Cloud Apps capability that watches OAuth apps for risky permissions, odd behaviour and new credentials.',
  'consent': 'Approval that lets an app use permissions. An admin’s consent can unlock access across the company.',
  'patient zero': 'The first account or system the attacker successfully got into. Everything else follows from it.',
  'tenant': 'An organization’s own instance of Microsoft Entra ID and Microsoft 365, with its own users, apps and data. A company can have several.',
  'admin consent': 'An admin approving an app’s permissions for the whole organization. One click can hand an app access to every mailbox.',
  'user consent': 'A regular user approving an app’s access to their own data. Many tenants now disable it.',
  'EWS': 'Exchange Web Services, an older API that apps use to read and send mail in Exchange Online.',
  'full_access_as_app': 'An Exchange Online application role that lets an app read every mailbox in the tenant without any user signing in.',
  'DLP': 'Data loss prevention. Policies that watch how people share or send sensitive content and can block it.',
  'sensitivity labels': 'Purview tags on documents and mail that classify them and can encrypt them or restrict who opens them.',
  'access reviews': 'Scheduled checks where owners confirm who should still have a role, group or app. Anything unconfirmed is removed.',
  'client secret': 'A password for an app. Whoever can manage the app can add another one at any time.',
  'residential proxy': 'Traffic routed through ordinary home internet connections so attacks look like normal users instead of a data centre.',
  'password spray': 'Trying a few common passwords against many accounts, slowly, instead of many passwords against one account.',
  'VPN': 'Virtual private network. An encrypted tunnel that lets a remote user onto the company network as if they were in the office.',
  'one-time passcode': 'A short code that changes every time, from an app or token. The second factor the legacy VPN profile never asked for.',
  'EDR': 'Endpoint detection and response. Software on laptops and servers that spots and stops malicious behaviour.',
  'Tor': 'An anonymity network that hides where traffic really comes from. Ransomware crews use it to hide their command servers.',
  'DMZ': 'A demilitarized zone: a buffer network between two zones (here IT and OT) where every crossing is inspected and allowed on purpose.',
  'OT': 'Operational technology. The systems that physically run things: pumps, valves, sensors, controllers.',
  'IT network': 'The ordinary corporate network: email, file shares, business apps. Where the ransom note appeared.',
  'ransomware': 'Malware that encrypts your files and demands payment for the key. Modern crews also steal the data first.',
  'decryptor': 'The tool criminals sell you after payment to unlock files. Often slow or buggy; backups beat it.',
  'double extortion': 'Steal the data, then encrypt it. Pay or we publish, and pay or you stay locked out.',
  'egress': 'Traffic leaving your network for the internet. Stolen data has to travel this way.',
  'allowlisting': 'Only approved programs may run. Everything else, including fresh ransomware, is blocked by default.',
  'segmentation': 'Splitting a network into zones with controlled crossings, so a breach in one zone cannot simply flow into the next.',
  'BitLocker': 'Windows disk encryption. Protects data if the drive is stolen, not from someone already signed in.',
  'least privilege': 'Give every account and app only the access it needs to do its job, and nothing more.',
  'VPN profile': 'A saved VPN connection setup with its own sign-in rules. A forgotten one can still let people in.',
  'single-factor': 'Signing in with only one proof, usually a password. If the password leaks, nothing else stands in the way.',
  'share drive': 'A shared network folder where teams keep files. Attackers copy it before encrypting, to threaten a leak.',
  'offline backup': 'A copy of your data kept disconnected from the network, so ransomware cannot reach or encrypt it.',
  'incident response plan': 'A written, rehearsed playbook for who does what when an attack is found, from the first alert to recovery.',
  'stop work authority': 'Colonial’s rule that anyone, from the CEO to an operator in the field, may halt operations if they believe safety is at risk.'
};
