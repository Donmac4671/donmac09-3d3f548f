import { useEffect } from "react";

/**
 * Lightweight per-route head updater (title, meta description, canonical, og:url).
 * Avoids pulling in react-helmet-async for a handful of static pages.
 */
export function usePageMeta(opts: {
  title?: string;
  description?: string;
  path?: string; // route path, e.g. "/login"
}) {
  const { title, description, path } = opts;

  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const upsertMeta = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      const prev = el.getAttribute("content") ?? "";
      el.setAttribute("content", value);
      return { el, prev };
    };

    const restores: Array<() => void> = [];

    if (description) {
      const { el, prev } = upsertMeta('meta[name="description"]', "name", "description", description);
      const og = upsertMeta('meta[property="og:description"]', "property", "og:description", description);
      const tw = upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
      restores.push(() => el.setAttribute("content", prev));
      restores.push(() => og.el.setAttribute("content", og.prev));
      restores.push(() => tw.el.setAttribute("content", tw.prev));
    }

    if (title) {
      const og = upsertMeta('meta[property="og:title"]', "property", "og:title", title);
      const tw = upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
      restores.push(() => og.el.setAttribute("content", og.prev));
      restores.push(() => tw.el.setAttribute("content", tw.prev));
    }

    if (path) {
      const url = `https://donmacdatahub.com${path}`;
      const og = upsertMeta('meta[property="og:url"]', "property", "og:url", url);
      restores.push(() => og.el.setAttribute("content", og.prev));

      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      const prevCanonical = canonical?.href;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = url;
      restores.push(() => {
        if (prevCanonical && canonical) canonical.href = prevCanonical;
      });
    }

    return () => {
      document.title = prevTitle;
      restores.forEach((fn) => fn());
    };
  }, [title, description, path]);
}
