/* BatStat sample data.
   Course codes, titles, units, year levels and terms follow the BS IT curriculum shown on the student portal.
   Sections, enrollment, grades, ratings and faculty assignments are invented for this design mockup.
   Faculty are coded on purpose. In production these rows would come from the integrated portal + SETE dataset. */
(function () {
  // sem: 1 = 1st Semester, 2 = 2nd Semester, 3 = Summer 1, 4 = Summer 2
  const SEMESTERS = [
    { ay: '2023-2024', sem: 1 }, { ay: '2023-2024', sem: 2 },
    { ay: '2024-2025', sem: 1 }, { ay: '2024-2025', sem: 2 },
    { ay: '2025-2026', sem: 1 }, { ay: '2025-2026', sem: 2 }
  ];
  const ALL_TERMS = SEMESTERS.flatMap(s => (s.sem === 2
    ? [s, { ay: s.ay, sem: 3 }, { ay: s.ay, sem: 4 }]
    : [s]));

  const DIMENSIONS = [
    'Commitment',
    'Knowledge of subject',
    'Independent learning',
    'Management of learning'
  ];

  const COLLEGES = [
    {
      id: 'CICS', name: 'College of Informatics and Computing Sciences',
      departments: [
        { id: 'IT', name: 'Information Technology', short: 'BS IT' },
        // CS appears only inside the college average; the chair cannot select it.
        { id: 'CS', name: 'Computer Science', short: 'BS CS' }
      ]
    }
  ];

  // Sections are blocks: IT-1201 is a 1st-year, 2nd-semester block that takes its courses together.
  const BLOCK_SIZE = {
    'IT-1101': 42, 'IT-1102': 40, 'IT-1201': 41, 'IT-1202': 39,
    'IT-2101': 39, 'IT-2102': 37, 'IT-2201': 38, 'IT-2202': 36,
    'IT-3101': 30, 'IT-3102': 15, 'IT-3201': 29, 'IT-3202': 14, 'IT-3S01': 28, 'IT-3S02': 14,
    'IT-4101': 37, 'IT-4201': 36
  };

  // [code, title, units, year, sem, [[section, faculty, enrolled?, capacity?], ...]]
  // Faculty A-H teach in the program. S1-S12 teach service courses from other departments.
  // NSTP groups students by component, so those rows set their own size.
  const IT_CURRICULUM = [
    // First year, first semester
    ['IT 111', 'Introduction to Computing', 3, 1, 1, [['IT-1101', 'A'], ['IT-1102', 'G']]],
    ['Fili 101', 'Kontekstwalisadong Komunikasyon sa Filipino', 3, 1, 1, [['IT-1101', 'S1'], ['IT-1102', 'S1']]],
    ['GEd 102', 'Mathematics in the Modern World', 3, 1, 1, [['IT-1101', 'S4'], ['IT-1102', 'S10']]],
    ['GEd 103', 'Life and Works of Rizal', 3, 1, 1, [['IT-1101', 'S3'], ['IT-1102', 'S2']]],
    ['GEd 104', 'The Contemporary World', 3, 1, 1, [['IT-1101', 'S2'], ['IT-1102', 'S3']]],
    ['GEd 108', 'Art Appreciation', 3, 1, 1, [['IT-1101', 'S3'], ['IT-1102', 'S3']]],
    ['NSTP 111', 'National Service Training Program 1', 3, 1, 1, [['NS-1101', 'S5', 18, 30]]],
    ['NSTP 111CW', 'NSTP - Civic Welfare Training Service 1', 3, 1, 1, [['CW-1101', 'S5', 40, 45]]],
    ['NSTP 111LT', 'NSTP - Literacy Training Service 1', 3, 1, 1, [['LT-1101', 'S6', 18, 30]]],
    ['NSTP 111RO', 'NSTP - Reserve Officers Training Corps 1', 3, 1, 1, [['RO-1101', 'S7', 22, 30]]],
    ['PATHFit 1', 'Movement Competency Training', 2, 1, 1, [['IT-1101', 'S8'], ['IT-1102', 'S8']]],

    // First year, second semester
    ['CS 111', 'Computer Programming', 3, 1, 2, [['IT-1201', 'E'], ['IT-1202', 'D']]],
    ['CS 131', 'Data Structures and Algorithms', 3, 1, 2, [['IT-1201', 'E'], ['IT-1202', 'C']]],
    ['Fili 102', "Filipino sa Iba't-ibang Disiplina", 3, 1, 2, [['IT-1201', 'S1'], ['IT-1202', 'S1']]],
    ['GEd 105', 'Readings in Philippine History', 3, 1, 2, [['IT-1201', 'S2'], ['IT-1202', 'S2']]],
    ['GEd 109', 'Science, Technology and Society', 3, 1, 2, [['IT-1201', 'S3'], ['IT-1202', 'S9']]],
    ['MATH 111', 'Linear Algebra', 3, 1, 2, [['IT-1201', 'S4'], ['IT-1202', 'S4']]],
    ['NSTP 121', 'National Service Training Program 2', 3, 1, 2, [['NS-1201', 'S5', 18, 30]]],
    ['NSTP 121CW', 'NSTP - Civic Welfare Training Service 2', 3, 1, 2, [['CW-1201', 'S5', 38, 45]]],
    ['NSTP 121LT', 'NSTP - Literacy Training Service 2', 3, 1, 2, [['LT-1201', 'S6', 18, 30]]],
    ['NSTP 121RO', 'NSTP - Reserve Officers Training Corps 2', 3, 1, 2, [['RO-1201', 'S7', 22, 30]]],
    ['PATHFit 2', 'Exercise-Based Fitness Activities', 2, 1, 2, [['IT-1201', 'S8'], ['IT-1202', 'S8']]],

    // Second year, first semester
    ['PATHFit 3', 'Traditional and Recreational Games', 2, 2, 1, [['IT-2101', 'S8'], ['IT-2102', 'S8']]],
    ['Litr 102', 'ASEAN Literature', 3, 2, 1, [['IT-2101', 'S1'], ['IT-2102', 'S1']]],
    ['Phy 101', 'Calculus-Based Physics', 3, 2, 1, [['IT-2101', 'S10'], ['IT-2102', 'S10']]],
    ['IT 212', 'Computer Networking 1', 3, 2, 1, [['IT-2101', 'B'], ['IT-2102', 'H']]],
    ['IT 211', 'Database Management System', 3, 2, 1, [['IT-2101', 'F'], ['IT-2102', 'A']]],
    ['CpE 405', 'Discrete Mathematics', 3, 2, 1, [['IT-2101', 'S11'], ['IT-2102', 'S11']]],
    ['CS 211', 'Object-Oriented Programming', 3, 2, 1, [['IT-2101', 'C'], ['IT-2102', 'D']]],
    ['CS 121', 'Advanced Computer Programming', 3, 2, 1, [['IT-2101', 'D'], ['IT-2102', 'C']]],

    // Second year, second semester
    ['IT 222', 'Advanced Database Management System', 3, 2, 2, [['IT-2201', 'F'], ['IT-2202', 'A']]],
    ['IT 223', 'Computer Networking 2', 3, 2, 2, [['IT-2201', 'B'], ['IT-2202', 'B']]],
    ['MATH 408', 'Data Analysis', 3, 2, 2, [['IT-2201', 'S4'], ['IT-2202', 'S10']]],
    ['ES 101', 'Environmental Sciences', 3, 2, 2, [['IT-2201', 'S9'], ['IT-2202', 'S9']]],
    ['IT 221', 'Information Management', 3, 2, 2, [['IT-2201', 'F'], ['IT-2202', 'F']]],
    ['GEd 106', 'Purposive Communication', 3, 2, 2, [['IT-2201', 'S1'], ['IT-2202', 'S2']]],
    ['GEd 101', 'Understanding the Self', 3, 2, 2, [['IT-2201', 'S3'], ['IT-2202', 'S3']]],
    ['PATHFit 4', 'Team Sports (Basketball and Volleyball)', 2, 2, 2, [['IT-2201', 'S8'], ['IT-2202', 'S8']]],

    // Third year, first semester
    ['GEd 107', 'Ethics', 3, 3, 1, [['IT-3101', 'S2'], ['IT-3102', 'S2']]],
    ['BAT 402', 'Fundamentals of Analytics Modeling', 3, 3, 1, [['IT-3101', 'F'], ['IT-3102', 'F']]],
    ['BAT 401', 'Fundamentals of Business Analytics', 3, 3, 1, [['IT-3101', 'D'], ['IT-3102', 'D']]],
    ['IT 313', 'System Analysis and Design', 3, 3, 1, [['IT-3101', 'G'], ['IT-3102', 'G']]],
    ['IT 311', 'Systems Administration and Maintenance', 3, 3, 1, [['IT-3101', 'B'], ['IT-3102', 'B']]],
    ['IT 312', 'Systems Integration and Architecture', 3, 3, 1, [['IT-3101', 'A'], ['IT-3102', 'H']]],
    ['IT 314', 'Web Systems and Technologies', 3, 3, 1, [['IT-3101', 'C'], ['IT-3102', 'G']]],

    // Third year, second semester
    ['IT 322', 'Advanced Systems Integration and Architecture', 3, 3, 2, [['IT-3201', 'B'], ['IT-3202', 'B']]],
    ['BAT 404', 'Analytics Techniques and Tools', 3, 3, 2, [['IT-3201', 'D'], ['IT-3202', 'D']]],
    ['IT 324', 'Capstone Project 1', 3, 3, 2, [['IT-3201', 'A'], ['IT-3202', 'A']]],
    ['BAT 403', 'Fundamentals of Enterprise Data Management', 3, 3, 2, [['IT-3201', 'D'], ['IT-3202', 'D']]],
    ['IT 321', 'Human-Computer Interaction', 3, 3, 2, [['IT-3201', 'G'], ['IT-3202', 'G']]],
    ['IT 323', 'Information Assurance and Security', 3, 3, 2, [['IT-3201', 'H'], ['IT-3202', 'H']]],
    ['IT 325', 'IT Project Management', 3, 3, 2, [['IT-3201', 'C'], ['IT-3202', 'C']]],

    // Third year, summer. The portal says only "Summer"; the split into Summer 1 and 2 is assumed.
    ['IT 331', 'Application Development and Emerging Technologies', 3, 3, 3, [['IT-3S01', 'C'], ['IT-3S02', 'G']]],
    ['IT 332', 'Integrative Programming and Technologies', 3, 3, 4, [['IT-3S01', 'E'], ['IT-3S02', 'H']]],

    // Fourth year, first semester
    ['IT 413', 'Advanced Information Assurance and Security', 3, 4, 1, [['IT-4101', 'H']]],
    ['BAT 405', 'Analytics Application', 3, 4, 1, [['IT-4101', 'F']]],
    ['IT 411', 'Capstone Project 2', 3, 4, 1, [['IT-4101', 'A']]],
    ['IT 412', 'Platform Technologies', 3, 4, 1, [['IT-4101', 'C']]],
    ['CS 423', 'Social Issues and Professional Practice', 3, 4, 1, [['IT-4101', 'D']]],
    ['IT 414', 'Systems Quality Assurance', 3, 4, 1, [['IT-4101', 'E']]],
    ['ENGG 405', 'Technopreneurship', 3, 4, 1, [['IT-4101', 'S12']]],

    // Fourth year, second semester
    ['IT 421', 'IT Internship Training', 6, 4, 2, [['IT-4201', 'H']]]
  ];

  // CS exists only for the college average, so it keeps a simple class list offered every semester.
  const CS_CLASSES = [
    ['CS 101', 'Fundamentals of Programming', 'CS-1101', 'J', 40],
    ['CS 201', 'Algorithms and Complexity', 'CS-2101', 'K', 38],
    ['CS 202', 'Discrete Structures', 'CS-2102', 'L', 39],
    ['CS 301', 'Operating Systems', 'CS-3101', 'J', 34],
    ['CS 302', 'Software Engineering', 'CS-3102', 'M', 33],
    ['CS 401', 'Machine Learning', 'CS-4101', 'N', 30]
  ];
  const CS_SUMMER = {
    3: [['CS 101', 'Fundamentals of Programming', 'CS-S101', 'J', 20]],
    4: [['CS 201', 'Algorithms and Complexity', 'CS-S201', 'K', 17]]
  };

  // Program-wide drift per dimension across the six regular semesters.
  const DRIFT = {
    IT: [[-.08, -.06, -.03, 0, .02, .04], [0, .01, .02, .03, .03, .04], [-.1, -.07, -.04, -.02, .01, .03], [.1, .08, .04, 0, -.05, -.11]],
    CS: [[-.05, -.03, 0, .02, .03, .04], [.02, .02, .03, .04, .04, .05], [-.04, -.02, 0, .01, .02, .03], [-.03, -.02, 0, .01, .02, .03]]
  };

  // Each teacher has a stable level and profile, so results stay believable from term to term.
  // base is the level in the latest semester; trend is the change per semester.
  const TEACHING = {
    A: { base: 4.15, trend: .01, dims: [-.16, .14, .03, 0], late: .04 },
    B: { base: 4.2, trend: .01, dims: [.02, .17, -.18, 0], late: .04 },
    C: { base: 3.98, trend: .02, dims: [.05, .1, 0, -.16], late: .05 },
    D: { base: 4.3, trend: .01, dims: [.08, .12, -.18, -.02], late: .02 },
    E: { base: 3.42, trend: -.05, dims: [.02, .22, -.06, -.28], late: .08 },
    F: { base: 3.88, trend: .01, dims: [.06, .16, -.04, -.18], late: .06 },
    G: { base: 3.42, trend: -.01, dims: [-.3, .22, .02, .06], late: .1 },
    H: { base: 4.15, trend: 0, dims: [.08, .2, -.2, -.08], late: .22 }
  };

  // Typical results by kind of course.
  function courseProfile(code) {
    if (/^PATHFit/.test(code)) return { pass: .97, bump: .14 };
    if (/^NSTP/.test(code)) return { pass: .95, bump: .08 };
    if (/^(GEd|Fili|Litr|ES)/.test(code)) return { pass: .91, bump: .04 };
    if (/^(MATH|Phy|CpE)/.test(code)) return { pass: .8, bump: -.1 };
    if (code === 'CS 111' || code === 'CS 121' || code === 'CS 131') return { pass: .81, bump: -.04 };
    if (code === 'IT 421') return { pass: .97, bump: .1 };
    if (code === 'IT 324' || code === 'IT 411') return { pass: .91, bump: 0 };
    return { pass: .88, bump: 0 };
  }

  const RESPONSE_BY_YEAR = { 1: .8, 2: .73, 3: .67, 4: .6 };

  // Theme wording follows the SETE dimension it relates to, in the same order as DIMENSIONS.
  const CONCERNS = [
    ['Classes often start late', 'Limited consultation time', 'Hard to reach outside class'],
    ['Lessons rely heavily on slides', 'Examples feel outdated', 'Answers to questions are unclear'],
    ['Few independent activities', 'Little room for student ideas', 'Too much guidance on outputs'],
    ['Slow feedback on outputs', 'Topics rushed near exams', 'Unclear grading criteria']
  ];
  const STRENGTHS = [
    ['Always prepared for class', 'Approachable', 'Respects class time'],
    ['Clear explanations', 'Real-world examples', 'Strong subject knowledge'],
    ['Encourages own solutions', 'Useful hands-on activities', 'Supports student projects'],
    ['Well-organized lessons', 'Fair grading', 'Timely feedback']
  ];

  // Hand-set rows for the default view (AY 2025-2026, 2nd semester), keyed by course and section.
  const STORY = {
    'CS 131|IT-1201': { ratings: [3.34, 3.62, 3.21, 2.96], enrolled: 42, responses: 31, passed: 26, midtermFail: 15, lateDays: 0 },
    'CS 111|IT-1202': { ratings: [4.42, 4.48, 4.11, 4.18], enrolled: 40, responses: 33, passed: 28, midtermFail: 11, lateDays: 0 },
    'GEd 105|IT-1201': { ratings: [4.2, 4.3, 4.1, 4], enrolled: 46, responses: 34, passed: 42, midtermFail: 4, lateDays: 0 },
    'MATH 111|IT-1202': { ratings: [4, 4.2, 3.9, 3.8], enrolled: 40, responses: 28, passed: 28, midtermFail: 12, lateDays: 0 },
    'IT 222|IT-2202': { ratings: [3.9, 4.1, 3.8, 3.7], enrolled: 36, responses: 4, passed: 31, midtermFail: 3, lateDays: 0 },
    'IT 223|IT-2202': { ratings: [4.05, 4.21, 3.88, 3.92], enrolled: 36, responses: 14, passed: 31, midtermFail: 4, lateDays: 0 },
    'IT 321|IT-3201': { ratings: [3.04, 3.71, 3.36, 3.28], enrolled: 29, responses: 22, passed: 26, midtermFail: 2, lateDays: 0 },
    'IT 323|IT-3201': { ratings: [4.11, 4.36, 3.94, 3.87], enrolled: 29, responses: 21, passed: 27, midtermFail: 1, lateDays: 4 }
  };

  // Profiles for the chair's own program. otherUnits covers teaching outside BS IT and admin designations.
  const FACULTY = {
    'Faculty A': { rank: 'Associate Professor', status: 'Permanent', specialization: 'Databases and capstone', designation: 'Capstone Coordinator', otherUnits: 9 },
    'Faculty B': { rank: 'Assistant Professor', status: 'Permanent', specialization: 'Networking and systems', otherUnits: 9 },
    'Faculty C': { rank: 'Assistant Professor', status: 'Permanent', specialization: 'Programming and project management', otherUnits: 9 },
    'Faculty D': { rank: 'Assistant Professor', status: 'Permanent', specialization: 'Programming and analytics', otherUnits: 3 },
    'Faculty E': { rank: 'Instructor', status: 'Temporary', specialization: 'Algorithms', otherUnits: 15 },
    'Faculty F': { rank: 'Associate Professor', status: 'Permanent', specialization: 'Data management', otherUnits: 3 },
    'Faculty G': { rank: 'Instructor', status: 'Part-time', specialization: 'Web and human-computer interaction', otherUnits: 6 },
    'Faculty H': { rank: 'Professor', status: 'Permanent', specialization: 'Information security', designation: 'Internship Coordinator', otherUnits: 3 }
  };

  function seeded(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return function () {
      h = (h + 0x6D2B79F5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round2 = v => Math.round(v * 100) / 100;

  // Only some respondents write comments; lower ratings bring more comments about concerns.
  function themesFor(rand, ratings, responses) {
    if (responses < 5) return [];
    const order = ratings.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const pick = list => list[Math.floor(rand() * list.length)];
    const avg = ratings.reduce((a, b) => a + b, 0) / 4;
    const commenters = Math.max(3, Math.round(responses * (.35 + rand() * .25)));
    const concernShare = clamp((4.6 - avg) * .4, .15, .7);
    const concerns = Math.max(1, Math.round(commenters * concernShare));
    const strengths = Math.max(1, commenters - concerns);
    const firstConcern = Math.ceil(concerns * .65);
    const firstStrength = Math.ceil(strengths * .6);
    const themes = [
      { label: pick(STRENGTHS[order[3]]), tone: 'strength', count: firstStrength },
      { label: pick(CONCERNS[order[0]]), tone: 'concern', count: firstConcern }
    ];
    if (strengths > firstStrength) themes.push({ label: pick(STRENGTHS[order[2]]), tone: 'strength', count: strengths - firstStrength });
    if (concerns > firstConcern) themes.push({ label: pick(CONCERNS[order[1]]), tone: 'concern', count: concerns - firstConcern });
    return themes;
  }

  function makeRecord(college, dept, cls, term, si, seedKey, story) {
    const { code, title, section, faculty, enrolledBase, capacity, units, year } = cls;
    const service = /^S\d+$/.test(faculty);
    const rand = seeded(seedKey);
    const profile = courseProfile(code);

    // Hashed levels cover teachers without a set profile: service faculty and CS.
    const hashed = seeded(dept.id + faculty);
    const teacher = (dept.id === 'IT' && TEACHING[faculty]) || {
      base: 3.85 + hashed() * .5, trend: .01, late: .06,
      dims: DIMENSIONS.map(() => (hashed() - .5) * .3)
    };

    const growth = [.92, .96, 1][Math.floor(si / 2)];
    const enrolled = story ? story.enrolled : Math.round(enrolledBase * growth) + Math.floor(rand() * 3);
    const ratings = story ? story.ratings : DIMENSIONS.map((_, d) => round2(clamp(
      teacher.base + teacher.trend * (si - 5) + teacher.dims[d] + profile.bump +
      DRIFT[dept.id][d][si] + (rand() - .5) * .16, 1, 5)));
    const avg = ratings.reduce((a, b) => a + b, 0) / 4;

    const responseRate = clamp((RESPONSE_BY_YEAR[year] || .7) + (si - 5) * .012 + (rand() - .5) * .16, .3, .95);
    const responses = story ? story.responses : Math.round(enrolled * responseRate);

    const passRate = clamp(profile.pass + (avg - 4) * .07 + (rand() - .5) * .1, .6, .99);
    const passed = story ? story.passed : Math.round(enrolled * passRate);

    // Everyone who did not pass ends up failed, incomplete or dropped.
    const notPassed = enrolled - passed;
    const dropped = Math.min(notPassed, Math.round(notPassed * .15 + rand() * .6));
    const inc = Math.min(notPassed - dropped, Math.round(notPassed * .25 + rand() * .6));
    const failed = notPassed - dropped - inc;
    const midtermFail = story ? story.midtermFail : Math.round(failed * 1.1 + inc * .6 + rand() * 1.5);

    // Philippine scale: 1.00 is the highest grade and 3.00 is the lowest passing grade.
    const avgGrade = round2(clamp(2.3 - (passed / enrolled - .85) * 2.4 + (rand() - .5) * .3, 1.25, 2.95));
    const lateDays = story ? story.lateDays : (rand() < teacher.late ? 1 + Math.floor(rand() * 6) : 0);

    return {
      id: `${section}|${code}|${term.ay}|${term.sem}`,
      ay: term.ay, sem: term.sem, college: college.id, dept: dept.id,
      code, title, section, year, units, capacity, service,
      faculty: service ? `Service ${faculty.slice(1)}` : `Faculty ${faculty}`,
      enrolled, responses, ratings, passed, failed, inc, dropped, avgGrade, midtermFail, lateDays,
      themes: themesFor(rand, ratings, responses)
    };
  }

  function buildRecords() {
    const out = [];
    const college = COLLEGES[0];
    const [it, cs] = college.departments;
    const lastRegular = SEMESTERS.length - 1;

    const sections = IT_CURRICULUM.flatMap(([code, title, units, year, sem, list]) =>
      list.map(([section, faculty, enrolled, capacity]) => ({
        code, title, units, year, sem, section, faculty,
        enrolledBase: enrolled || BLOCK_SIZE[section],
        capacity: capacity || 45
      })));

    SEMESTERS.forEach((term, si) => {
      sections.filter(c => c.sem === term.sem).forEach(c => {
        const key = `${c.code}|${c.section}`;
        const story = si === lastRegular ? STORY[key] : null;
        out.push(makeRecord(college, it, c, term, si, `${key}|${si}`, story));
      });
      if (term.sem === 2) {
        [3, 4].forEach(sem => sections.filter(c => c.sem === sem).forEach(c => {
          out.push(makeRecord(college, it, c, { ay: term.ay, sem }, si, `${c.code}|${c.section}|${term.ay}`, null));
        }));
      }
    });

    const csClass = ([code, title, section, faculty, enrolledBase]) =>
      ({ code, title, section, faculty, enrolledBase, capacity: 45, units: 3, year: Number(section.charAt(3)) || 1 });
    // Several blocks per course give CS a realistic weight in the college average.
    CS_CLASSES.forEach(c => [1, 2, 3, 4].forEach(block => SEMESTERS.forEach((term, si) => {
      const section = `${c[2]}-${block}`;
      const cls = csClass([c[0], c[1], section, c[3], c[4]]);
      out.push(makeRecord(college, cs, cls, term, si, `${section}|${si}`, null));
    })));
    SEMESTERS.forEach((term, si) => {
      if (term.sem !== 2) return;
      [3, 4].forEach(sem => CS_SUMMER[sem].forEach(c => {
        out.push(makeRecord(college, cs, csClass(c), { ay: term.ay, sem }, si, `${c[2]}|${term.ay}`, null));
      }));
    });
    return out;
  }

  window.BATSTAT_DATA = {
    semesters: ALL_TERMS,
    regularTerms: SEMESTERS,
    dimensions: DIMENSIONS,
    colleges: COLLEGES,
    records: buildRecords(),
    faculty: FACULTY,
    // The signed-in user in this mockup.
    user: { role: 'Program Chair', college: 'CICS', dept: 'IT', short: 'BS IT' },
    // Assumed values for the mockup, not official university policy.
    thresholds: {
      sete: 3.5, response: 50, pass: 75, midtermClass: 25, atRiskShare: 15, onTime: 90, minResponses: 5,
      loadMax: 18, loadRoom: 12, mentorSete: 4.1, fillLow: 60
    }
  };
})();
