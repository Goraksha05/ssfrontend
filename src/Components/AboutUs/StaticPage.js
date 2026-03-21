import React, { useEffect } from 'react';

const StaticPage = ({ title, content }) => {
  useEffect(() => {
    if (title) {
      document.title = `${title} - SoShoLife`;
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', (content || '').slice(0, 160));
    }
  }, [title, content]);

  if (!title) {
    return (
      <div
        style={{
          padding: 24,
          color: 'var(--text-muted)',
          background: 'var(--bg-page)',
          minHeight: '100vh',
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        Page not found.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        padding: '40px 16px 60px',
        fontFamily: "'Nunito', sans-serif",
        transition: 'var(--theme-transition, background 0.3s, color 0.3s)',
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '40px 44px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 8,
            color: 'var(--text-heading)',
            textAlign: 'center',
            letterSpacing: '-0.3px',
          }}
        >
          {title}
        </h1>
        <div
          style={{
            width: 48,
            height: 4,
            borderRadius: 4,
            background: 'var(--accent-gradient)',
            margin: '0 auto 28px',
          }}
        />
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: 15,
            lineHeight: 1.8,
            whiteSpace: 'pre-line',
          }}
        >
          {content}
        </p>
      </div>
    </div>
  );
};

export default StaticPage;