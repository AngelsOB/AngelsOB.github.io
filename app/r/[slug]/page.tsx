// /r/[slug] is the public recipe viewer. HS chrome is provided by ClientShell
// (which now wraps non-/betabuilder routes in HSThemeWrapper). The inner
// PublicRecipeClient still uses some classic Tailwind styling — to be brought
// under HS overrides in a follow-up.
export { default, generateMetadata } from "@/../app/betabuilder/r/[slug]/page";
