/**
 * Shape of a community recipe summary card as fetched from `publicRecipeIndex`
 * and rendered in the home community section. Kept here (rather than co-located
 * with a component) so the type can be shared between the server fetcher in
 * `app/page.tsx` and the client `SectionCommunity` component without forcing
 * a dependency on either's surrounding code.
 */
export interface CommunityRecipeCard {
  name: string;
  style: string;
  ownerName: string;
  ownerId: string;
  shareSlug: string;
  tags: string[];
  forkCount: number;
  publishedAt: string;
  stats: {
    abv: number;
    ibu: number;
    srm: number;
    og: number;
    fg: number;
  };
}
