/**
 * Academic Catalogue: Schools, Departments, and their associated Courses.
 * Used for cascading filters and user onboarding / editing forms.
 */

export const DEPARTMENT_COURSES = {
  // ── School of Technology, Communication and Management ──
  "Department of Computer Sciences": [
    "B.Sc. Information Technology (Honors)",
    "Bachelor of Computer Application (Honors)",
    "Master of Computer Application (Data Science)",
    "Ph. D. Computer Science",
  ],

  "Department of Tourism Management": [
    "B.B.A Tourism & Travel Management (Honors)",
    "M.B.A. Tourism & Travel Management",
    "Ph. D. Tourism Management",
  ],

  "Department of Journalism & Mass Communication": [
    "B.A. Journalism and Mass Communication (Honors)",
    "M. A. Journalism and Mass Communication",

    "Ph. D. Journalism and Mass Communication",
  ],

  "Department of Animation and Visual Effects": [
    "B.Voc. (Bachelor of Vocation) in 3D Animation and VFX (Honors)",
    "B.Des Animation and Visual Effects",
    "B.Sc. Animation",
    "Diploma in 3D Modeling",
    "M.Sc. Animation",
  ],

  // ── School of Biological Sciences and Sustainability ──
  "Department of Rural Management": [
    "Bachelor of Rural Studies (Honors)",
    "BBA Rural Management",
    "Diploma in Rural Development",
    "M.B.A. Rural Management",
    "MBA Rural Management",
  ],
  "Department of Rural Studies and Sustainability": [
    "Bachelor of Rural Studies (Honors)",
    "BBA Rural Management",
    "Diploma in Rural Development",
    "M.B.A. Rural Management",
  ],

  "Department of Environmental Science": [
    "B.Sc Environmental Science",
  ],

  // ── School of Education, Humanities and Social Sciences ──
  "Department of Education": [
    "B.Ed. (Bachelor of Education)",
  ],

  "Department of English": [
    "B.A. English (Honors)",
    "M.A. English Literature",
  ],

  "Department of Psychology": [

    "B.A. Psychology (Honors)",
    "M.A. Clinical Psychology",
    "M.A. Counselling Psychology",
    "M.Sc. Counselling Psychology",
    "Ph. D. Psychology",
  ],

  "Department of Scientific Spirituality": [],

  // ── School of Indology ──
  "Department of Sanskrit and Vedic Studies": [
    "B.A. Sanskrit Studies",
    "M.A. Sanskrit",
    "M.A. Vedic Philosophy",
    "Ph.D. Sanskrit",
  ],

  "Department of Hindi": [

    "B.A. Hindi (Honors)",

    "M.A. Hindi Literature",
    "Ph.D. Hindi",
  ],

  "Department of History and Indian Culture": [
    "B.A. History (Honors)",
    "B.A. Indian Culture & Heritage",
    "M. A. History and Indian Culture",
    "Ph. D. History",
  ],

  "Department of Indian Classical Music": [
    "B.A. Indian Classical Music (Vocal)",
    "B.A. Music (Vocal) (Honors)",
    "B.A. Music Instrumental Mridang/Tabla (Honors)",
    "M.A. Classical Instruments",
    "M.A. Music (Tabla, Pakhaawaj)",
    "M.A. Music (Vocal)",
    "Ph. D. Indian Classical Music",
  ],

  "Dept. of Oriental Studies, Religious Studies & Philosophy": [
    "Diploma in Comparative Religion",
    "M.A. Hindu Studies",
    "M.A. Philosophy",
    "M.A. Philosophy & Religious Studies",
  ],
  "Department of Oriental Studies, Religious Studies & Philosophy": [
    "Diploma in Comparative Religion",
    "M.A. Hindu Studies",
    "M.A. Philosophy",
    "M.A. Philosophy & Religious Studies",
  ],

  "Department of Yogic Sciences and Human Consciousness": [
    "B.Sc. Yogic Science (Honors)",
    "Certificate In Yoga And Alternative Therapy",
    "M.A. Human Consciousness & Yogic Science",
    "M.Sc Yogic Science & Human Consciousness",
    "M.Sc. Human Consciousness & Yogic Science",
    "M.Sc. Yoga Therapy",
    "P. G. Diploma Human Consciousness, Yoga & Alternative Therapy",

  ],

  "Department of Complementary and Alternative Medicine": [
    "M.A. in Indigenous and Traditional Therapies",
    "M.Sc. in Indigenous and Traditional Therapies",
  ],
};

export const SCHOOL_DEPARTMENTS = {
  "School of Technology, Communication and Management": [
    "Department of Computer Sciences",
    "Department of Tourism Management",
    "Department of Journalism & Mass Communication",
    "Department of Animation and Visual Effects",
  ],
  "School of Biological Sciences and Sustainability": [
    "Department of Rural Management",
    "Department of Rural Studies and Sustainability",
    "Department of Environmental Science",
  ],
  "School of Humanities, Social Sciences and Human Values": [
    "Department of English",
    "Department of Education",
    "Department of Psychology",
    "Department of Scientific Spirituality",
    "Dept. of Oriental Studies, Religious Studies & Philosophy",
    "Department of Oriental Studies, Religious Studies & Philosophy",
  ],
  "School of Indology": [
    "Department of Sanskrit and Vedic Studies",
    "Department of Hindi",
    "Department of Indian Classical Music",
    "Department of History and Indian Culture",
    "Department of Yogic Sciences and Human Consciousness",
    "Department of Complementary and Alternative Medicine",
    "Dept. of Oriental Studies, Religious Studies & Philosophy",
    "Department of Oriental Studies, Religious Studies & Philosophy",
  ],
};

/**
 * Get courses for a specific department.
 * Merges catalogue courses and any DB-provided courses.
 */
export function getCoursesForDepartment(deptName, dbCourses = []) {
  if (!deptName) return [];
  const set = new Set();

  // Check catalogue matches (direct or case-insensitive)
  const norm = deptName.trim().toLowerCase();
  for (const [key, list] of Object.entries(DEPARTMENT_COURSES)) {
    if (key.trim().toLowerCase() === norm) {
      list.forEach((c) => set.add(c));
    }
  }

  // Merge any dynamically fetched courses from DB for this department
  if (Array.isArray(dbCourses)) {
    dbCourses.forEach((item) => {
      const match =
        (item.department_name && item.department_name.trim().toLowerCase() === norm) ||
        (item.department_id && item.department_id === deptName);
      if (match && item.course) {
        set.add(item.course);
      }
    });
  }

  return Array.from(set).sort();
}

/**
 * Get all courses for a given school across all its departments.
 */
export function getCoursesForSchool(schoolName, dbDepartments = [], dbCourses = []) {
  if (!schoolName) return [];
  const set = new Set();
  const targetDepts = dbDepartments.filter((d) => d.school === schoolName);

  targetDepts.forEach((dept) => {
    getCoursesForDepartment(dept.name, dbCourses).forEach((c) => set.add(c));
  });

  // Also check catalogue school departments fallback
  const catalogDepts = SCHOOL_DEPARTMENTS[schoolName] || [];
  catalogDepts.forEach((deptName) => {
    getCoursesForDepartment(deptName, dbCourses).forEach((c) => set.add(c));
  });

  // Also include any dbCourses matching school directly
  if (Array.isArray(dbCourses)) {
    dbCourses.forEach((item) => {
      if (item.school === schoolName && item.course) {
        set.add(item.course);
      }
    });
  }

  return Array.from(set).sort();
}

/**
 * Get all available courses across all departments and DB courses.
 */
export function getAllCourses(dbCourses = []) {
  const set = new Set();
  Object.values(DEPARTMENT_COURSES).forEach((list) => {
    list.forEach((c) => set.add(c));
  });
  if (Array.isArray(dbCourses)) {
    dbCourses.forEach((item) => {
      if (item.course) set.add(item.course);
    });
  }
  return Array.from(set).sort();
}

