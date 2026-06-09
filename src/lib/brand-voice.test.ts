import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBrandVoiceForPrompt,
  hasStructuredVoice,
  voiceProfileTitle,
} from "@/lib/brand-voice";
import { brandProfileSchema } from "@/lib/schemas";

test("brand voice falls back to legacy preferredVoice", () => {
  const profile = brandProfileSchema.parse({
    appName: "Tiny Lemon",
    targetMerchant: "Shopify apparel brands",
    positioning: "Turn flat-lay photos into on-model product images.",
    featuresUseCases: ["AI on-model photos"],
    preferredVoice: "clear, practical, founder-led",
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "soft educational CTA",
    existingBlogDocsUrls: [],
  });

  assert.equal(hasStructuredVoice(profile), false);
  assert.equal(voiceProfileTitle(profile), "clear, practical, founder-led");
  assert.match(formatBrandVoiceForPrompt(profile), /Voice: clear, practical/);
});

test("structured voice creates a detailed prompt contract", () => {
  const profile = brandProfileSchema.parse({
    appName: "Tiny Lemon",
    targetMerchant: "Shopify apparel brands",
    positioning: "Turn flat-lay photos into on-model product images.",
    featuresUseCases: ["AI on-model photos"],
    preferredVoice: "",
    voiceProfile: {
      name: "Tiny Lemon Lab",
      description: "Brand/editorial voice for a practical product image lab.",
      toneTraits: ["visual", "specific", "operator-friendly"],
      writingRules: ["Use brand voice, not fake founder voice."],
      phrasesToUse: ["product image lab"],
      phrasesToAvoid: ["game-changing"],
      sampleLines: ["Your product page can look editorial without a new shoot."],
    },
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "soft educational CTA",
    existingBlogDocsUrls: [],
  });

  const formatted = formatBrandVoiceForPrompt(profile);

  assert.equal(hasStructuredVoice(profile), true);
  assert.equal(voiceProfileTitle(profile), "Tiny Lemon Lab");
  assert.match(formatted, /Voice name: Tiny Lemon Lab/);
  assert.match(formatted, /Tone traits:\n- visual/);
  assert.match(formatted, /Avoid phrases:\n- game-changing/);
  assert.match(formatted, /Do not imply a fake founder/);
});
