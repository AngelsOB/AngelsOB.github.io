import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Brewing.It collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Brewing.It",
    description: "How Brewing.It collects, uses, and protects your data.",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | Brewing.It",
    description: "How Brewing.It collects, uses, and protects your data.",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 brew-animate-in">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "var(--hs-font-display)", letterSpacing: "-0.035em", color: "var(--fg-strong)" }}
      >
        Privacy Policy
      </h1>
      <p className="text-sm mb-10" style={{ color: "var(--fg-muted)" }}>
        Last updated: March 23, 2026
      </p>

      <div
        className="prose-sm space-y-6"
        style={{ color: "var(--fg-muted)" }}
      >
        <Section title="What This Covers">
          <p>
            This policy explains what data Brewing.It collects, why we collect
            it, and how we protect it. We keep things simple: we collect the
            minimum we need to make the app work and we don&apos;t sell your
            data to anyone.
          </p>
        </Section>

        <Section title="What We Collect">
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              Account information.
            </strong>{" "}
            When you sign in with Google, we receive your name, email address,
            and profile photo from Google. We use this to identify your account
            and display your name on shared recipes.
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              Recipes and settings.
            </strong>{" "}
            Your recipes, equipment profiles, and preferences are stored in
            Google Cloud Firestore so they sync across your devices. Recipes
            you publish are visible to anyone with the link.
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              Payment information.
            </strong>{" "}
            If you subscribe to a paid tier, payments are processed by Stripe.
            We never see or store your full card number. Stripe handles all
            payment data under their own{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--coral-500)] hover:underline"
            >
              privacy policy
            </a>
            .
          </p>
          <p>
            <strong style={{ color: "var(--fg-strong)" }}>
              Basic usage data.
            </strong>{" "}
            We use standard server logs that include your IP address, browser
            type, and pages visited. We don&apos;t use third-party analytics
            or tracking scripts.
          </p>
        </Section>

        <Section title="How We Use It">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To provide and maintain the recipe builder and calculators</li>
            <li>To sync your recipes across devices</li>
            <li>To process payments through Stripe</li>
            <li>To display your name on recipes you choose to publish</li>
          </ul>
          <p>
            We don&apos;t use your data for advertising. We don&apos;t sell it.
            We don&apos;t share it with third parties except as described above
            (Google for authentication, Stripe for payments, Google Cloud for
            hosting).
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use essential cookies for authentication (keeping you signed in)
            and session management. We don&apos;t use advertising or tracking
            cookies.
          </p>
        </Section>

        <Section title="Data Storage and Security">
          <p>
            Your data is stored in Google Cloud Firestore (US regions). Data
            in transit is encrypted via HTTPS. Firebase Authentication handles
            credential security. We follow standard security practices but no
            system is 100% secure.
          </p>
        </Section>

        <Section title="Your Choices">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              You can delete your recipes at any time from the recipe list.
            </li>
            <li>
              You can unpublish shared recipes to remove them from public
              access.
            </li>
            <li>
              To delete your account entirely, contact us and we&apos;ll remove
              your data.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p>
            Brewing.It is intended for users of legal drinking age. We do not
            knowingly collect data from minors.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we make significant changes to this policy, we&apos;ll update
            the date at the top. Continued use of the site after changes
            constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Reach us at{" "}
            <a
              href="mailto:support@brewing.it.com"
              className="text-[var(--coral-500)] hover:underline"
            >
              support@brewing.it.com
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="text-lg font-bold mb-2"
        style={{ fontFamily: "var(--hs-font-display)", letterSpacing: "-0.035em", color: "var(--fg-strong)" }}
      >
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
