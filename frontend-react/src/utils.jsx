import React from 'react';
import { Link } from 'react-router-dom';

export function parseMentions(text) {
  if (!text) return text;
  
  // Split the text using a regex that captures @username
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link 
          key={index} 
          to={`/profile/${username}`} 
          className="text-cyan-600 font-bold hover:underline hover:text-orange-500 transition-colors"
          onClick={(e) => e.stopPropagation()} // Prevent triggering parent clicks (like opening a post)
        >
          {part}
        </Link>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
