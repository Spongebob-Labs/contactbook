import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ProfileOnboardingService } from '../../../profile/profile-onboarding.service';
import { getUserId } from './_shared';

/**
 * `get_my_profile` — read tool. Returns the caller's full nested
 * profile (identity + personal + work[] + business[] + socials[] +
 * financial.*). Financial field VALUES are masked in the formatter
 * inside ProfileOnboardingService (the read path already masks them
 * per CLAUDE.md invariant #5), so the LLM sees labels and types
 * only.
 */
export function buildGetMyProfileTool(profile: ProfileOnboardingService) {
  return tool(
    async (_args, config) => {
      const userId = getUserId(config);
      const me = await profile.getMe(userId);
      return JSON.stringify(me);
    },
    {
      name: 'get_my_profile',
      description:
        "Return the caller's full ContactBook profile — identity, personal details, work entries, business entries, social profiles, and (label-only) financial fields. Use this whenever the user asks 'what's in my profile', 'show me my details', 'do you have my work email', etc.",
      schema: z.object({}),
    },
  );
}
