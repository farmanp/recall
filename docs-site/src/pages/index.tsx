import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

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
      </div>
    </header>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ flex: 1, padding: '1rem' }}>
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
              />
              <Feature
                title="Multi-Agent Support"
                description="Works with Claude Code, Gemini CLI, and Codex CLI. All your AI sessions in one place."
              />
              <Feature
                title="File Tracking"
                description="Track every file read, write, and edit. Full diffs for all changes."
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
