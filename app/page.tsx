import Link from "next/link";
import styles from "./landing.module.css";

const benefits = [
  {
    number: "01",
    title: "Tell us what you bring",
    text: "Build your profile and turn your experience into a clear professional story.",
  },
  {
    number: "02",
    title: "Discover your best matches",
    text: "Explore opportunities aligned with your skills, interests, and goals.",
  },
  {
    number: "03",
    title: "Make a real connection",
    text: "Schedule focused time with the companies you are excited to meet.",
  },
];

function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        <span className={styles.keyRing} />
        <span className={styles.keyStem} />
      </span>
      <span>CareerKey</span>
    </span>
  );
}

export default function Page() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brandLink} aria-label="CareerKey home">
          <Brand />
        </Link>

        <div className={styles.navActions}>
          <Link href="/auth?mode=login" className={styles.loginLink}>
            Log in
          </Link>
          <Link href="/auth?mode=signup" className={styles.navCta}>
            Sign up
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Career connections, made simpler
          </div>
          <h1>Your next opportunity starts with the right connection.</h1>
          <p className={styles.heroText}>
            CareerKey helps students show what they can do, discover companies
            that fit, and turn introductions into meaningful conversations.
          </p>

          <div className={styles.heroActions}>
            <Link href="/auth?mode=signup" className={styles.primaryCta}>
              Create your account
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/auth?mode=login" className={styles.secondaryCta}>
              I already have an account
            </Link>
          </div>

          <p className={styles.helperText}>
            Built for students and recruiting teams participating in the EPP Expo.
          </p>
        </div>

        <div className={styles.preview} aria-label="How CareerKey works">
          <div className={styles.previewGlow} />
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewLabel}>YOUR CAREER PATH</span>
              <span className={styles.readyPill}>Ready to explore</span>
            </div>

            <div className={styles.matchCard}>
              <div className={styles.matchIcon}>CK</div>
              <div>
                <span className={styles.matchOverline}>Strong match</span>
                <h2>Meet companies looking for you.</h2>
              </div>
              <div className={styles.matchScore}>92%</div>
            </div>

            <div className={styles.previewSteps}>
              {benefits.map((benefit) => (
                <div className={styles.previewStep} key={benefit.number}>
                  <span>{benefit.number}</span>
                  <div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audiences} aria-label="CareerKey users">
        <article className={styles.audienceCard}>
          <span className={styles.audienceIcon} aria-hidden="true">S</span>
          <div>
            <h2>For students</h2>
            <p>Present your strengths, find relevant opportunities, and plan your expo day.</p>
          </div>
        </article>
        <article className={styles.audienceCard}>
          <span className={`${styles.audienceIcon} ${styles.companyIcon}`} aria-hidden="true">C</span>
          <div>
            <h2>For companies</h2>
            <p>Share open roles, meet aligned candidates, and manage conversations efficiently.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
