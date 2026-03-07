import type { Metadata } from 'next';
import UserProfileClient from '@/modules/sharing/UserProfileClient';

interface PageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params;

  return {
    title: 'Brewer Profile',
    description: `View public recipes by this brewer on BeerApp`,
    alternates: { canonical: `/u/${userId}` },
    openGraph: {
      title: 'Brewer Profile — BeerApp',
      url: `/u/${userId}`,
      type: 'profile',
      siteName: 'BeerApp',
    },
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { userId } = await params;
  return <UserProfileClient userId={userId} />;
}
