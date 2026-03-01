import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

const imageStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  border: '1px solid rgba(0, 0, 0, 0.1)',
};

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className="hero hero--primary" style={{ padding: '4rem 0' }}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
          <Link className="button button--secondary button--lg" to="/docs/getting-started">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            to="https://github.com/hyperbrew/recall"
          >
            GitHub
          </Link>
        </div>
        <div style={{ marginTop: '2rem' }}>
          <code
            style={{
              fontSize: '1.2rem',
              padding: '0.5rem 1rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            }}
          >
            npx recall-player@latest
          </code>
        </div>
        <div style={{ marginTop: '3rem', maxWidth: '900px', margin: '3rem auto 0' }}>
          <img
            src="/img/overview.png"
            alt="Recall overview showing 591 sessions, $4K saved, and multi-agent breakdown"
            style={imageStyle}
          />
        </div>
      </div>
    </header>
  );
}

interface FeatureProps {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

function Feature({ title, description, image, imageAlt }: FeatureProps) {
  return (
    <div style={{ flex: 1, minWidth: '280px', padding: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <img src={image} alt={imageAlt} style={imageStyle} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={`${siteConfig.title}`} description="The DVR for AI coding sessions">
      <HomepageHeader />
      <main>
        <section style={{ padding: '4rem 0' }}>
          <div className="container">
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <Feature
                title="Replay Sessions"
                description="Scroll through AI coding sessions like a video. See every message, every tool call, every file change."
                image="/img/transcript_view.png"
                imageAlt="Transcript view showing conversation replay with timestamps"
              />
              <Feature
                title="Session Analysis"
                description="Detect complexity outliers, duplicate utilities, and architectural drift across your codebase."
                image="/img/generated_insights.png"
                imageAlt="Session insights showing 19 files modified, 4K lines changed"
              />
              <Feature
                title="Multi-Agent Library"
                description="Claude Code, Gemini CLI, and Codex CLI — all your AI sessions in one searchable library."
                image="/img/sessions_view.png"
                imageAlt="Sessions library with multi-agent filtering"
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
