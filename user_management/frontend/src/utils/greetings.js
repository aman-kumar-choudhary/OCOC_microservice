/**
 * Campus Greeting & Human Sentiment Helpers
 * Provides warm, time-aware greetings and thoughtful, role-grounded context
 * reflecting the ethos of Dev Sanskriti Vishwavidyalaya and residential university life.
 */

export const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
};

export const getHumanGreeting = (displayName = "Campus Member", role = "") => {
  const time = getTimeOfDay();
  const name = displayName?.split(" ")[0] || "Friend";

  const salutations = {
    morning: `Good morning, ${name} 🙏`,
    afternoon: `Good afternoon, ${name} 🙏`,
    evening: `Good evening, ${name} 🙏`,
    night: `Shubh Ratri, ${name} 🙏`,
  };

  const roleText = String(role).toUpperCase();

  let contextMessage = "Welcome to your campus digital portal. Wishing you a peaceful and productive day.";

  if (roleText.includes("WARDEN")) {
    contextMessage = "Thank you for guiding our hostel residents with care and diligence. Review student leave passes and night curfews below.";
  } else if (roleText.includes("SECURITY_ADMIN") || roleText.includes("GUARD")) {
    contextMessage = "Thank you for safeguarding our campus perimeter, gates, and student community day and night.";
  } else if (roleText.includes("STUDENT")) {
    contextMessage = "Wishing you a focused, inspiring day in your lectures and hostel campus life. Stay mindful of campus timings and values.";
  } else if (roleText.includes("FACULTY")) {
    contextMessage = "Wishing you a fruitful day of mentorship, research, and inspiring the minds of our university students.";
  } else if (roleText.includes("ADMIN") || roleText.includes("SUPER_ADMIN")) {
    contextMessage = "University governance and campus identity systems are running smoothly under your care.";
  }

  return {
    timeOfDay: time,
    greeting: salutations[time] || `Namaste, ${name} 🙏`,
    contextMessage,
    dateDisplay: new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
};
