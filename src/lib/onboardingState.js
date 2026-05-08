export const CURRENT_ONBOARDING_VERSION = '2026.05'

export const EXPERIENCE_LEVELS = ['new', 'learning', 'operational', 'advanced', 'power_user']

export const INITIALIZATION_MODES = [
  'guided_seeded',
  'clean_workspace',
  'future_demo_workspace',
  'future_imported_workspace',
]

export function getDefaultOnboardingVersion() {
  return CURRENT_ONBOARDING_VERSION
}
