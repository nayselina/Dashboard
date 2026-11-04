/* BatStat sample data.
   Every record is invented for this design mockup. Faculty are coded on purpose.
   In production these rows would come from the integrated portal + SETE dataset. */
(function () {
  // sem: 1 = 1st Semester, 2 = 2nd Semester, 3 = Summer 1, 4 = Summer 2
  const SEMESTERS = [
    { ay: '2023-2024', sem: 1 }, { ay: '2023-2024', sem: 2 },
    { ay: '2024-2025', sem: 1 }, { ay: '2024-2025', sem: 2 },
    { ay: '2025-2026', sem: 1 }, { ay: '2025-2026', sem: 2 }
  ];
  const ALL_TERMS = SEMESTERS.flatMap((s, i) => (s.sem === 2
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

  // code, title, section, faculty, enrolled
  const CLASSES = {
    IT: [
      ['IT 101', 'Introduction to Computing', 'IT-1101', 'A', 42],
      ['IT 101', 'Introduction to Computing', 'IT-1102', 'B', 40],
      ['IT 102', 'Computer Programming', 'IT-1103', 'C', 41],
      ['IT 102', 'Computer Programming', 'IT-1104', 'D', 40],
      ['IT 201', 'Data Structures and Algorithms', 'IT-2101', 'E', 42],
      ['IT 201', 'Data Structures and Algorithms', 'IT-2102', 'C', 38],
      ['IT 202', 'Database Management Systems', 'IT-2103', 'F', 39],
      ['IT 202', 'Database Management Systems', 'IT-2104', 'A', 38],
      ['IT 301', 'Web Systems and Technologies', 'IT-3101', 'G', 36],
      ['IT 302', 'Computer Networking', 'IT-3102', 'H', 37],
      ['IT 302', 'Computer Networking', 'IT-3103', 'B', 38],
      ['IT 401', 'Information Assurance and Security', 'IT-4101', 'H', 34],
      ['BAT 405', 'Analytics Application', 'IT-4102', 'F', 35]
    ],
    CS: [
      ['CS 101', 'Fundamentals of Programming', 'CS-1101', 'J', 40],
      ['CS 201', 'Algorithms and Complexity', 'CS-2101', 'K', 38],
      ['CS 202', 'Discrete Structures', 'CS-2102', 'L', 39],
      ['CS 301', 'Operating Systems', 'CS-3101', 'J', 34],
      ['CS 302', 'Software Engineering', 'CS-3102', 'M', 33],
      ['CS 401', 'Machine Learning', 'CS-4101', 'N', 30]
    ]
  };

  // Summer terms run a few small classes, mostly for retakes and back subjects.
  const SUMMER_CLASSES = {
    IT: {
      3: [
        ['IT 102', 'Computer Programming', 'IT-S101', 'C', 24],
        ['IT 201', 'Data Structures and Algorithms', 'IT-S102', 'E', 18]
      ],
      4: [
        ['IT 202', 'Database Management Systems', 'IT-S201', 'F', 20],
        ['IT 301', 'Web Systems and Technologies', 'IT-S202', 'G', 16]
      ]
    },
    CS: {
      3: [['CS 101', 'Fundamentals of Programming', 'CS-S101', 'J', 20]],
      4: [['CS 201', 'Algorithms and Complexity', 'CS-S201', 'K', 17]]
    }
  };

  // Small semester-to-semester drift per dimension, so trends have a shape.
  const DRIFT = {
    IT: [[-.1, -.07, -.03, 0, .03, .05], [0, .02, .03, .03, .05, .06], [-.14, -.1, -.05, -.02, .01, .04], [.14, .1, .05, 0, -.08, -.16]],
    CS: [[-.05, -.03, 0, .02, .03, .04], [.02, .02, .03, .04, .04, .05], [-.04, -.02, 0, .01, .02, .03], [-.03, -.02, 0, .01, .02, .03]]
  };

  const CONCERNS = ['Limited consultation time', 'Topics rushed near exams', 'Few independent activities', 'Slow feedback on outputs'];
  const STRENGTHS = ['Clear explanations', 'Approachable', 'Real-world examples', 'Well-organized lessons'];

  // Hand-set rows for the default view (AY 2025-2026, 2nd semester, IT).
  const STORY = {
    'IT-2101': { ratings: [3.34, 3.62, 3.21, 2.96], enrolled: 42, responses: 31, passed: 26, midtermFail: 15, lateDays: 0 },
    'IT-1104': { ratings: [4.42, 4.48, 4.11, 4.18], enrolled: 40, responses: 33, passed: 28, midtermFail: 11, lateDays: 0 },
    'IT-3101': { ratings: [3.04, 3.71, 3.36, 3.28], enrolled: 36, responses: 28, passed: 32, midtermFail: 3, lateDays: 0 },
    'IT-3103': { ratings: [4.05, 4.21, 3.88, 3.92], enrolled: 38, responses: 14, passed: 33, midtermFail: 4, lateDays: 0 },
    'IT-4101': { ratings: [4.11, 4.36, 3.94, 3.87], enrolled: 34, responses: 26, passed: 31, midtermFail: 2, lateDays: 4 },
    'IT-2104': { ratings: [3.9, 4.1, 3.8, 3.7], enrolled: 38, responses: 4, passed: 33, midtermFail: 3, lateDays: 0 },
    'IT-2102': { ratings: [3.95, 4.1, 3.9, 3.85], enrolled: 22, responses: 16, passed: 18, midtermFail: 3, lateDays: 0 },
    'IT-1101': { ratings: [4.2, 4.3, 4.1, 4], enrolled: 46, responses: 30, passed: 40, midtermFail: 5, lateDays: 0 }
  };

  // Profiles for the chair's own program. otherUnits covers teaching outside BS IT and admin designations.
  const FACULTY = {
    'Faculty A': { rank: 'Associate Professor', status: 'Permanent', specialization: 'Computing fundamentals', otherUnits: 12 },
    'Faculty B': { rank: 'Assistant Professor', status: 'Permanent', specialization: 'Networking', otherUnits: 15 },
    'Faculty C': { rank: 'Assistant Professor', status: 'Permanent', specialization: 'Programming', otherUnits: 9 },
    'Faculty D': { rank: 'Instructor', status: 'Permanent', specialization: 'Programming', otherUnits: 15 },
    'Faculty E': { rank: 'Instructor', status: 'Temporary', specialization: 'Algorithms', otherUnits: 18 },
    'Faculty F': { rank: 'Associate Professor', status: 'Permanent', specialization: 'Data management', otherUnits: 6 },
    'Faculty G': { rank: 'Instructor', status: 'Part-time', specialization: 'Web development', otherUnits: 9 },
    'Faculty H': { rank: 'Professor', status: 'Permanent', specialization: 'Information security', otherUnits: 9 }
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

  function themesFor(rand, ratings, responses) {
    if (responses < 5) return [];
    let low = 0;
    ratings.forEach((v, i) => { if (v < ratings[low]) low = i; });
    const best = ratings.indexOf(Math.max(...ratings));
    const weak = clamp(4.6 - ratings[low], .12, .6);
    return [
      { label: STRENGTHS[best], tone: 'strength', count: Math.round(responses * (.28 + rand() * .2)) },
      { label: STRENGTHS[(best + 2) % 4], tone: 'strength', count: Math.round(responses * (.12 + rand() * .12)) },
      { label: CONCERNS[low], tone: 'concern', count: Math.max(1, Math.round(responses * weak)) }
    ];
  }

  function makeRecord(college, dept, cls, term, driftIndex, seedKey, capacity, story) {
    const [code, title, section, faculty, enrolledBase] = cls;
    const facultyRand = seeded(dept.id + faculty);
    const base = 3.75 + facultyRand() * .65;
    const dimBase = DIMENSIONS.map(() => (facultyRand() - .5) * .6);
    const rand = seeded(seedKey);
    const enrolled = story ? story.enrolled : enrolledBase + Math.round((rand() - .5) * 6);
    const ratings = story ? story.ratings : DIMENSIONS.map((_, d) =>
      round2(clamp(base + dimBase[d] + DRIFT[dept.id][d][driftIndex] + (rand() - .5) * .18, 1, 5)));
    const avg = ratings.reduce((a, b) => a + b, 0) / 4;
    const responses = story ? story.responses : Math.round(enrolled * (.56 + rand() * .32));
    const passRate = clamp(.84 + (avg - 4) * .08 + (rand() - .5) * .1, .76, .98);
    const passed = story ? story.passed : Math.round(enrolled * passRate);
    const midtermFail = story ? story.midtermFail :
      Math.round((enrolled - passed) * (.7 + rand() * .5));
    const lateDays = story ? story.lateDays : (rand() < .09 ? 1 + Math.floor(rand() * 5) : 0);
    return {
      id: `${section}|${term.ay}|${term.sem}`,
      ay: term.ay, sem: term.sem, college: college.id, dept: dept.id,
      code, title, section, faculty: `Faculty ${faculty}`,
      units: 3, capacity,
      enrolled, responses, ratings, passed, midtermFail, lateDays,
      themes: themesFor(rand, ratings, responses)
    };
  }

  function buildRecords() {
    const out = [];
    COLLEGES.forEach(college => college.departments.forEach(dept => {
      CLASSES[dept.id].forEach(cls => SEMESTERS.forEach((s, si) => {
        const story = si === SEMESTERS.length - 1 && dept.id === 'IT' ? STORY[cls[2]] : null;
        out.push(makeRecord(college, dept, cls, s, si, `${cls[2]}|${si}`, 45, story));
      }));
      SEMESTERS.forEach((s, si) => {
        if (s.sem !== 2) return;
        [3, 4].forEach(sem => SUMMER_CLASSES[dept.id][sem].forEach(cls => {
          out.push(makeRecord(college, dept, cls, { ay: s.ay, sem }, si, `${cls[2]}|${s.ay}`, 30, null));
        }));
      });
    }));
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
