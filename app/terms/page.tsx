import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for using the Brewing.It recipe builder and calculators.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Brewing.It",
    description:
      "Terms of service for using the Brewing.It recipe builder and calculators.",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | Brewing.It",
    description:
      "Terms of service for using the Brewing.It recipe builder and calculators.",
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 brew-animate-in">
      <h1
        className="text-3xl font-bold mb-2"
        style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
      >
        Terms of Service
      </h1>
      <p className="text-sm mb-10" style={{ color: "var(--fg-muted)" }}>
        Last updated: March 23, 2026
      </p>

      <div
        className="prose-sm space-y-6"
        style={{ color: "var(--fg-muted)" }}
      >
        <Section title="What This Is">
          <p>
            Brewing.It is a homebrewing recipe builder and calculator. By using
            the site, you agree to these terms. If you don&apos;t agree, please
            don&apos;t use the site.
          </p>
        </Section>

        <Section title="Your Account">
          <p>
            You can use the calculators and browse public recipes without an
            account. To save recipes, you need to sign in with Google. You&apos;re
            responsible for your account and anything that happens under it.
          </p>
        </Section>

        <Section title="Your Recipes">
          <p>
            Recipes you create belong to you. By publishing a recipe, you grant
            Brewing.It permission to display it publicly and allow other users
            to fork (copy) it. You can unpublish a recipe at any time to remove
            it from public access.
          </p>
          <p>
            Don&apos;t publish content that&apos;s illegal, harmful, or
            infringes on someone else&apos;s rights. We reserve the right to
            remove content that violates these terms.
          </p>
        </Section>

        <Section title="Paid Subscriptions">
          <p>
            Some features require a paid subscription, processed through Stripe.
            Subscriptions renew automatically unless you cancel. You can cancel
            at any time from your account settings, and you&apos;ll retain
            access until the end of your billing period.
          </p>
          <p>
            Prices may change with notice. We don&apos;t offer refunds for
            partial billing periods, but if something goes wrong, reach out and
            we&apos;ll work it out.
          </p>
        </Section>

        <Section title="The Calculations">
          <p>
            The recipe builder, calculators, and learn articles are provided
            for informational and educational purposes. While we work hard to
            make them accurate, brewing is a physical process and results vary
            by system, ingredients, and technique. The numbers are targets, not
            guarantees.
          </p>
          <p>
            We are not responsible for the outcome of any brew made using
            calculations from this site. Always use good brewing practices and
            your own judgment.
          </p>
        </Section>

        <Section title="Acceptable Use">
          <p>Don&apos;t use Brewing.It to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Scrape, crawl, or bulk-download content beyond normal use
            </li>
            <li>
              Attempt to access other users&apos; accounts or private data
            </li>
            <li>Interfere with the site&apos;s operation or infrastructure</li>
            <li>Use the platform for anything illegal</li>
          </ul>
        </Section>

        <Section title="Availability">
          <p>
            We do our best to keep the site running, but we can&apos;t guarantee
            100% uptime. We may update, change, or discontinue features at any
            time. If we ever shut down entirely, we&apos;ll give you time to
            export your recipes.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            Brewing.It is provided &ldquo;as is&rdquo; without warranties of
            any kind. To the extent permitted by law, we are not liable for any
            indirect, incidental, or consequential damages arising from your
            use of the site.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms from time to time. If we make significant
            changes, we&apos;ll update the date at the top. Continued use after
            changes constitutes acceptance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Reach us at{" "}
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
        style={{ fontFamily: "'Bitter', serif", color: "var(--fg-strong)" }}
      >
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
