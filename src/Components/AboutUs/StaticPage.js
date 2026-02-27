import React from 'react';

const StaticPage = ({ title, content }) => {
  React.useEffect(() => {
    if (title) {
      document.title = `${title} - SoShoLife`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', content.slice(0, 160));
      } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = content.slice(0, 160);
        document.head.appendChild(meta);
      }
    }
  }, [title, content]);

  if (!title) return <div className="p-4">Page not found.</div>;

  return (
    <div className="p-4 sm:p-6 bg-white rounded-2xl shadow-lg max-w-4xl mx-auto mt-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">{title}</h1>
      <p className="text-gray-700 text-base sm:text-lg leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
};

export default StaticPage;
