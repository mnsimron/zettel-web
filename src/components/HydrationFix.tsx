'use client';

import { useEffect } from 'react';

export function HydrationFix() {
  useEffect(() => {
    const stripInjectedAttributes = () => {
      const elements = document.querySelectorAll('[bis_skin_checked]');
      elements.forEach((element) => {
        element.removeAttribute('bis_skin_checked');
      });
    };

    stripInjectedAttributes();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          if (target.hasAttribute('bis_skin_checked')) {
            target.removeAttribute('bis_skin_checked');
          }
        }
      }

      stripInjectedAttributes();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['bis_skin_checked'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
