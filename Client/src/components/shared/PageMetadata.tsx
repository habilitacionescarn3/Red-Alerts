import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_METADATA, getBaseUrl } from '@/data/defaultMetadata';

export interface PageMetadataProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  canonicalPath?: string;
  noIndex?: boolean;
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function PageMetadata({
  title,
  description,
  keywords,
  image,
  canonicalPath,
  noIndex,
}: PageMetadataProps) {
  const { pathname } = useLocation();
  const baseUrl = getBaseUrl();

  const resolvedTitle = title ?? DEFAULT_METADATA.title;
  const resolvedDescription = description ?? DEFAULT_METADATA.description;
  const resolvedKeywords = keywords ?? DEFAULT_METADATA.keywords;
  const resolvedRobots = noIndex ? 'noindex, nofollow' : DEFAULT_METADATA.robots;
  const imagePath = image ?? DEFAULT_METADATA.image;
  const imageUrl = imagePath.startsWith('http')
    ? imagePath
    : `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  const canonical = canonicalPath
    ? `${baseUrl}${canonicalPath.startsWith('/') ? '' : '/'}${canonicalPath}`
    : `${baseUrl}${pathname}`;

  useEffect(() => {
    document.title = resolvedTitle;
    setMetaTag('name', 'description', resolvedDescription);
    setMetaTag('name', 'keywords', resolvedKeywords);
    setMetaTag('name', 'author', DEFAULT_METADATA.author);
    setMetaTag('name', 'robots', resolvedRobots);
    setMetaTag('property', 'og:type', DEFAULT_METADATA.ogType);
    setMetaTag('property', 'og:url', canonical);
    setMetaTag('property', 'og:title', resolvedTitle);
    setMetaTag('property', 'og:description', resolvedDescription);
    setMetaTag('property', 'og:image', imageUrl);
    setCanonical(canonical);
  }, [resolvedTitle, resolvedDescription, resolvedKeywords, resolvedRobots, canonical, imageUrl]);

  return null;
}
