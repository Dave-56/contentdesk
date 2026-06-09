import type { BrandProfile, VoiceProfile } from "@/lib/schemas";

export function hasStructuredVoice(profile: BrandProfile) {
  return Boolean(
    profile.voiceProfile &&
      [
        profile.voiceProfile.name,
        profile.voiceProfile.description,
        ...profile.voiceProfile.toneTraits,
        ...profile.voiceProfile.writingRules,
        ...profile.voiceProfile.phrasesToUse,
        ...profile.voiceProfile.phrasesToAvoid,
        ...profile.voiceProfile.sampleLines,
      ].some((value) => value.trim().length > 0),
  );
}

export function voiceProfileTitle(profile: BrandProfile) {
  if (hasStructuredVoice(profile)) {
    return profile.voiceProfile?.name || "Custom voice";
  }

  return profile.preferredVoice || "clear, practical, founder-led";
}

export function formatBrandVoiceForPrompt(profile: BrandProfile) {
  if (!hasStructuredVoice(profile)) {
    return [
      `Voice: ${voiceProfileTitle(profile)}.`,
      "Use this as a light style constraint. Do not invent a persona beyond the Brand Profile.",
    ].join("\n");
  }

  const voice = profile.voiceProfile as VoiceProfile;

  return [
    `Voice name: ${voice.name || "Custom voice"}.`,
    voice.description ? `Voice description: ${voice.description}.` : "",
    formatList("Tone traits", voice.toneTraits),
    formatList("Writing rules", voice.writingRules),
    formatList("Preferred phrases", voice.phrasesToUse),
    formatList("Avoid phrases", voice.phrasesToAvoid),
    formatList("Sample lines", voice.sampleLines),
    "Use this voice consistently, but keep claims grounded in Brand Profile and approved sources.",
    "Do not imply a fake founder, employee, or human narrator unless the voice description explicitly says so.",
  ].filter(Boolean).join("\n");
}

function formatList(label: string, values: string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";

  return `${label}:\n${cleaned.map((value) => `- ${value}`).join("\n")}`;
}
